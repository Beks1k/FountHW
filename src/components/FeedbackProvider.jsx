import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(() => {})
const ConfirmContext = createContext(async () => false)

export function useToast() {
  return useContext(ToastContext)
}

export function useConfirm() {
  return useContext(ConfirmContext)
}

const TOAST_ICONS = {
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 8v5M12 17h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 16v-5M12 8h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
}

export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const resolver = useRef(null)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((list) => [...list, { id, message, type }])
      setTimeout(() => dismiss(id), duration)
    },
    [dismiss]
  )

  const confirm = useCallback((options) => {
    const settings =
      typeof options === 'string' ? { message: options } : options || {}
    setDialog({
      title: settings.title || 'Are you sure?',
      message: settings.message || '',
      confirmLabel: settings.confirmLabel || 'Confirm',
      cancelLabel: settings.cancelLabel || 'Cancel',
      danger: settings.danger !== false,
      input: settings.input || null,
      inputValue: settings.input?.value || '',
    })
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const answer = (result) => {
    const current = dialog
    setDialog(null)
    if (resolver.current) {
      resolver.current(
        current?.input
          ? result
            ? (current.inputValue || '').trim()
            : null
          : result
      )
      resolver.current = null
    }
  }

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <span className="toast-icon">{TOAST_ICONS[t.type] || TOAST_ICONS.info}</span>
              <span className="toast-message">{t.message}</span>
              <button
                className="toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {dialog && (
          <div className="modal-overlay" onClick={() => answer(false)}>
            <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
              <div className={`confirm-icon ${dialog.danger ? 'danger' : ''}`}>
                {dialog.danger ? TOAST_ICONS.error : TOAST_ICONS.info}
              </div>
              <h3 className="confirm-title">{dialog.title}</h3>
              {dialog.message && (
                <p className="confirm-message">{dialog.message}</p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  answer(true)
                }}
              >
                {dialog.input && (
                  <div className="field confirm-field">
                    {dialog.input.label && (
                      <label>{dialog.input.label}</label>
                    )}
                    <input
                      className="input"
                      type="text"
                      autoFocus
                      value={dialog.inputValue}
                      placeholder={dialog.input.placeholder || ''}
                      maxLength={dialog.input.maxLength}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setDialog((d) => ({ ...d, inputValue: e.target.value }))
                      }
                    />
                  </div>
                )}
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => answer(false)}
                  >
                    {dialog.cancelLabel}
                  </button>
                  <button
                    type="submit"
                    className={`btn ${
                      dialog.danger ? 'btn-danger' : 'btn-primary'
                    }`}
                    disabled={
                      !!dialog.input &&
                      (dialog.inputValue || '').trim().length === 0
                    }
                  >
                    {dialog.confirmLabel}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}
