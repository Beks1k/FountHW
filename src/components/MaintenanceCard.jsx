import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useToast } from './FeedbackProvider'

export default function MaintenanceCard({ userData }) {
  const toast = useToast()
  const [current, setCurrent] = useState({ enabled: false, reason: '' })
  const [loaded, setLoaded] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return onSnapshot(
      doc(db, 'appConfig', 'maintenance'),
      (snap) => {
        const d = snap.exists() ? snap.data() : {}
        setCurrent({ enabled: d.enabled === true, reason: d.reason || '' })
        setLoaded(true)
      },
      () => setLoaded(true)
    )
  }, [])

  const save = async (enabled) => {
    setBusy(true)
    try {
      await setDoc(doc(db, 'appConfig', 'maintenance'), {
        enabled,
        reason: enabled ? reason.trim() : '',
        updatedAt: new Date().toISOString(),
        updatedBy: userData.email || '',
      })
      if (enabled) setReason('')
      toast(enabled ? 'App is blocked for everyone except you' : 'App is open again', 'success')
    } catch (err) {
      toast('Could not save. Check your connection and the Firestore rules.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="card-title">Maintenance mode</div>
          <div className="card-sub">
            Blocks everyone except you. They can sign in but only see your reason.
          </div>
        </div>
        <span className={current.enabled ? 'chip amber dot' : 'chip green dot'}>
          {current.enabled ? 'Blocked' : 'App is open'}
        </span>
      </div>

      {!loaded ? (
        <div className="empty">Loading...</div>
      ) : current.enabled ? (
        <>
          <div className="note warn" style={{ marginBottom: 14, whiteSpace: 'pre-wrap' }}>
            <b>Current reason</b>
            {current.reason || 'No reason given.'}
          </div>
          <button className="btn btn-primary" onClick={() => save(false)} disabled={busy}>
            {busy ? 'Saving...' : 'Open the app again'}
          </button>
        </>
      ) : (
        <>
          <div className="field">
            <label>Reason shown to users</label>
            <textarea
              className="input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. We are updating the app. Back at 18:00."
            />
          </div>
          <button
            className="btn btn-danger"
            onClick={() => save(true)}
            disabled={busy || !reason.trim()}
          >
            {busy ? 'Saving...' : 'Block the app'}
          </button>
        </>
      )}
    </div>
  )
}