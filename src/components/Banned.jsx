import { auth } from '../firebase'
import { signOut } from 'firebase/auth'
import ThemeToggle from './ThemeToggle'

export default function Banned() {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <div className="auth-brand">
          <div className="brand-mark">F</div>
          <span>FountHW</span>
        </div>
        <div className="note error" style={{ marginBottom: 18 }}>
          <b>Account banned</b>
          This account has been banned by an administrator. If you think this is
          a mistake, contact your teacher.
        </div>
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => signOut(auth)}
        >
          Logout
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
