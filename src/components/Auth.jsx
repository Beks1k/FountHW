import { useState } from 'react'
import { auth, db } from '../firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  query,
  collection,
  where,
  getDocs,
} from 'firebase/firestore'
import { checkEmailDomain } from '../utils/domain'
import PasswordInput from './PasswordInput'
import ThemeToggle from './ThemeToggle'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [role, setRole] = useState('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [classPin, setClassPin] = useState('')
  const [className, setClassName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential'
          ? 'Wrong email or password.'
          : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Try again in a moment.'
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (role === 'student' && classPin.length !== 6) {
      setError('Class PIN must be 6 digits')
      setLoading(false)
      return
    }

    try {
      const domainCheck = await checkEmailDomain(email)
      if (!domainCheck.ok) {
        setError(
          domainCheck.reason === 'unreachable'
            ? 'Could not verify your email domain. Check your connection and try again.'
            : 'Please use a real email address. That domain cannot receive mail.'
        )
        return
      }

      let cred = null
      try {
        cred = await createUserWithEmailAndPassword(auth, email, password)
      } catch (err) {
        setError(
          err.code === 'auth/email-already-in-use'
            ? 'That email is already registered. Try logging in.'
            : err.code === 'auth/weak-password'
            ? 'Password must be at least 6 characters.'
            : err.message
        )
        return
      }

      const uid = cred.user.uid
      let classId
      let teacherPin = null

      try {
        if (role === 'teacher') {
          const pin = Math.floor(100000 + Math.random() * 900000).toString()
          const classRef = doc(collection(db, 'classes'))
          await setDoc(classRef, {
            name: className,
            pin,
            teacherId: uid,
            teacherName: username,
            groups: {},
            createdAt: new Date().toISOString(),
          })
          classId = classRef.id
          teacherPin = pin
        } else {
          const q = query(collection(db, 'classes'), where('pin', '==', classPin))
          const snapshot = await getDocs(q)
          if (snapshot.empty) {
            setError('Invalid class PIN')
            throw new Error('handled')
          }
          classId = snapshot.docs[0].id
        }

        await setDoc(doc(db, 'users', uid), {
          username,
          email,
          role,
          classId,
          classPin: teacherPin,
          emailDomain: domainCheck.domain,
          domainVerified: true,
          banned: false,
          groupId: null,
          createdAt: new Date().toISOString(),
        })
      } catch (err) {
        // The account exists in Auth but has no working profile in Firestore.
        // Leaving it behind would bake it in as a phantom user, so remove it
        // and ask the person to try again.
        await deleteUser(cred.user).catch(() => {})
        if (err.message !== 'handled') {
          setError('Could not finish creating your account. Try again.')
        }
        return
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">F</div>
          <span>FountHW</span>
        </div>

        <div className="segment">
          <button
            className={role === 'student' ? 'on' : ''}
            onClick={() => setRole('student')}
          >
            Student
          </button>
          <button
            className={role === 'teacher' ? 'on' : ''}
            onClick={() => setRole('teacher')}
          >
            Teacher
          </button>
        </div>

        {error && (
          <div className="note error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="note warn" style={{ marginBottom: 16 }}>
          <b>Beta version</b>
          There is no way to recover a lost password yet. Write your password
          down and keep it somewhere safe.
        </div>

        {isLogin ? (
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="auth-foot">
              No account yet?{' '}
              <b onClick={() => { setIsLogin(false); setError('') }}>Create one</b>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="field">
              <label>Username</label>
              <input
                className="input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>
            {role === 'student' ? (
              <div className="field">
                <label>Class PIN (6 digits)</label>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  value={classPin}
                  onChange={(e) => setClassPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  required
                />
              </div>
            ) : (
              <div className="field">
                <label>Class name</label>
                <input
                  className="input"
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. English Level 5"
                  required
                />
              </div>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
            <div className="auth-foot">
              Already have an account?{' '}
              <b onClick={() => { setIsLogin(true); setError('') }}>Sign in</b>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
