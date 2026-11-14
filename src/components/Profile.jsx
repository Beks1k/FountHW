import { useState } from 'react'
import { auth, db } from '../firebase'
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { copyToClipboard } from '../utils/clipboard'
import PasswordInput from './PasswordInput'
import { useToast } from './FeedbackProvider'
import useSignOut from '../hooks/useSignOut'

export default function Profile({ userData, className }) {
  const toast = useToast()
  const signOutUser = useSignOut()
  const [tab, setTab] = useState('account')
  const [username, setUsername] = useState(userData.username || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [copiedPin, setCopiedPin] = useState(false)

  const flash = (text) => {
    setNotice(text)
    setError('')
    setTimeout(() => setNotice(''), 4000)
  }

  const saveUsername = async () => {
    setError('')
    setNotice('')
    const trimmed = username.trim()
    if (!trimmed) {
      setError('Username cannot be empty.')
      return
    }
    if (trimmed === userData.username) return
    setBusy(true)
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        username: trimmed,
      })
      flash('Username updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

    const changePassword = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The two new passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const user = auth.currentUser // Получаем текущего пользователя
      
      if (!user) {
        throw new Error('User context not found. Re-login please.')
      }

      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      )
      
      // ИСПРАВЛЕНО: Передаем user вместо auth
      await reauthenticateWithCredential(user, credential) 
      
      // ИСПРАВЛЕНО: Передаем user вместо auth.currentUser
      await updatePassword(user, newPassword)

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      flash('Password changed. Remember it — there is no way to recover it.')
    } catch (err) {
      setError(
        err.code === 'auth/wrong-password'
          ? 'That is not your current password.'
          : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Try again later.'
          : err.message
      )
    } finally {
      setBusy(false)
    }
  }


  return (
    <div>
      <div className="tabs">
        <div
          className={tab === 'account' ? 'tab on' : 'tab'}
          onClick={() => setTab('account')}
        >
          Account
        </div>
        {userData.classPin && (
          <div
            className={tab === 'privacy' ? 'tab on' : 'tab'}
            onClick={() => setTab('privacy')}
          >
            Class PIN
          </div>
        )}
      </div>

      {error && (
        <div className="note error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="note ok" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}

      {tab === 'account' && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">
              <div className="card-title">Your details</div>
            </div>

            <div className="field">
              <label>Username</label>
              <div className="hstack">
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 180 }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <button
                  className="btn btn-ghost"
                  onClick={saveUsername}
                  disabled={busy}
                >
                  Save
                </button>
              </div>
            </div>

            <div className="field">
              <label>Email</label>
              <input className="input" value={userData.email || ''} readOnly />
            </div>

            <div className="grid grid-2">
              <div className="field">
                <label>Role</label>
                <input
                  className="input"
                  value={userData.role === 'teacher' ? 'Teacher' : userData.role === 'parent' ? 'Parent' : 'Student'}
                  readOnly
                />
              </div>
              <div className="field">
                <label>Class</label>
                <input className="input" value={className || '—'} readOnly />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Change password</div>
                <div className="card-sub">
                  Remember it — a lost password cannot be recovered
                </div>
              </div>
            </div>
            <form onSubmit={changePassword}>
              <div className="field">
                <label>Current password</label>
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label>New password</label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
                <div className="field">
                  <label>Confirm new password</label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: 'auto' }}
                disabled={busy}
              >
                {busy ? 'Updating...' : 'Change password'}
              </button>
            </form>

            <div
              style={{
                marginTop: 26,
                paddingTop: 20,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 650, fontSize: 14.5 }}>Signed in</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {userData.email}
                </div>
              </div>
              <button className="btn btn-danger" onClick={signOutUser}>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'privacy' && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Class PIN</div>
              <div className="card-sub">
                Share this with your students so they can join
              </div>
            </div>
          </div>

          <div className="pinbox" style={{ marginBottom: 16 }}>
            <div className="stat-label" style={{ marginBottom: 6 }}>
              Your class PIN
            </div>
            <div className="pin">{userData.classPin}</div>
          </div>

          <div className="hstack">
            <button
              className="btn btn-ghost"
              onClick={async () => {
                const ok = await copyToClipboard(userData.classPin)
                if (ok) {
                  setCopiedPin(true)
                  setTimeout(() => setCopiedPin(false), 2000)
                  toast('Class PIN copied', 'success')
                } else {
                  toast(
                    'Could not copy automatically. Select the PIN and copy it by hand.',
                    'error',
                    6000
                  )
                }
              }}
            >
              {copiedPin ? 'Copied' : 'Copy PIN'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
