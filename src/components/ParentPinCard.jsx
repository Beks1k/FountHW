import { useEffect, useRef, useState } from 'react'
import { auth, db } from '../firebase'
import { copyToClipboard } from '../utils/clipboard'
import { useToast } from './FeedbackProvider'
import { createParentPin } from '../utils/parentLink'

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(Object.assign(new Error('timeout'), { code: 'timeout' })),
        ms
      )
    ),
  ])
}

export default function ParentPinCard({ userData }) {
  const toast = useToast()
  const [localPin, setLocalPin] = useState(null)
  const [errorCode, setErrorCode] = useState(null)
  const [busy, setBusy] = useState(false)
  const running = useRef(false)

  const pin = userData.parentPin || localPin
  const pinRef = useRef(pin)
  pinRef.current = pin

  const create = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setErrorCode(null)
    try {
      const created = await withTimeout(
        createParentPin(db, auth.currentUser.uid, userData.classId),
        15000
      )
      setLocalPin(created)
    } catch (err) {
      console.error('Parent PIN failed:', err)
      setErrorCode(err?.code || err?.message || 'unknown')
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!userData.classId) return
    // Short wait so an existing PIN has time to arrive before we create one.
    const t = setTimeout(() => {
      if (!pinRef.current) create()
    }, 1200)
    return () => clearTimeout(t)
  }, [userData.classId])

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="card-title">Parent PIN</div>
          <div className="card-sub">
            Give this to your parent so they can follow your homework and grades
          </div>
        </div>
      </div>

      {pin ? (
        <>
          <div className="pinbox" style={{ marginBottom: 16 }}>
            <div className="stat-label" style={{ marginBottom: 6 }}>
              Your parent PIN
            </div>
            <div className="pin">{pin}</div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              const ok = await copyToClipboard(pin)
              toast(
                ok
                  ? 'Parent PIN copied'
                  : 'Could not copy. Select the PIN and copy it by hand.',
                ok ? 'success' : 'error'
              )
            }}
          >
            Copy PIN
          </button>
        </>
      ) : errorCode ? (
        <>
          <div className="note error" style={{ marginBottom: 12 }}>
            Could not create your PIN ({errorCode}).
          </div>
          <button className="btn btn-ghost" onClick={create} disabled={busy}>
            Try again
          </button>
        </>
      ) : (
        <div className="empty">Creating your PIN...</div>
      )}
    </div>
  )
}