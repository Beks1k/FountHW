import useSignOut from '../hooks/useSignOut'

export default function Maintenance({ reason }) {
  const signOutUser = useSignOut()

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-brand">
          <div className="brand-mark">F</div>
          <span>FountHW</span>
        </div>

        <h2 style={{ margin: '8px 0 6px' }}>Under maintenance</h2>
        <p style={{ marginBottom: 16 }}>
          The app is temporarily unavailable. Please come back a little later.
        </p>

        {reason && (
          <div
            className="note warn"
            style={{ marginBottom: 16, textAlign: 'left', whiteSpace: 'pre-wrap' }}
          >
            <b>Reason</b>
            {reason}
          </div>
        )}

        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
          This page opens the app again by itself as soon as maintenance is over.
        </p>

        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={signOutUser}>
          Sign out
        </button>
      </div>
    </div>
  )
}