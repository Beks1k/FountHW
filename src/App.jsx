import { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import {
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import Auth from './components/Auth'
import TeacherDashboard from './components/TeacherDashboard'
import StudentDashboard from './components/StudentDashboard'
import ParentDashboard from './components/ParentDashboard'
import Maintenance from './components/Maintenance'
import Banned from './components/Banned'
import AccountInactive from './components/AccountInactive'
import { resolveView, mergeProfile } from './appState'
import { ADMIN_EMAIL } from './config'

function Loading() {
  return (
    <div className="loading">
      <div className="spinner"></div>
      <p>Loading FountHW...</p>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [serverData, setServerData] = useState(null)
  const [hasProfile, setHasProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [maintenance, setMaintenance] = useState({ uid: null, data: null })

  useEffect(() => {
    let unsubDoc = null
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (unsubDoc) {
        unsubDoc()
        unsubDoc = null
      }

      if (currentUser) {
        const cacheKey = `founthw:user:${currentUser.uid}`
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          try {
            setUserData(JSON.parse(cached))
            setLoading(false)
          } catch {}
        }
        unsubDoc = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
          const exists = snap.exists()
          const data = exists ? snap.data() : null
          setServerData(data)
          setHasProfile(exists)
          setUserData(data)
          if (data) {
            localStorage.setItem(cacheKey, JSON.stringify(data))
          } else {
            localStorage.removeItem(cacheKey)
          }
          setLoading(false)
        })
      } else {
        setUserData(null)
        setServerData(null)
        setHasProfile(null)
        setLoading(false)
      }
    })
    return () => {
      unsubscribe()
      if (unsubDoc) unsubDoc()
    }
  }, [])

  // Maintenance switch. If it cannot be read, the app stays open.
  useEffect(() => {
    const uid = user?.uid
    if (!uid) return
    return onSnapshot(
      doc(db, 'appConfig', 'maintenance'),
      (snap) => setMaintenance({ uid, data: snap.exists() ? snap.data() : null }),
      () => setMaintenance({ uid, data: null })
    )
  }, [user?.uid])

  const view = resolveView({
    user,
    userData,
    serverData,
    hasProfile,
    loading,
  })

  if (view === 'auth') return <Auth />
  if (view === 'banned') return <Banned />
  if (view === 'inactive') return <AccountInactive />
  if (view === 'loading') return <Loading />

  // Wait for the maintenance state so the app does not flash before the block.
  if (maintenance.uid !== user?.uid) return <Loading />

  const profile = mergeProfile(userData, serverData)

  if (maintenance.data?.enabled === true && profile.email !== ADMIN_EMAIL) {
    return <Maintenance reason={maintenance.data.reason} />
  }

  if (profile.role === 'teacher') {
    return <TeacherDashboard userData={profile} />
  }

  if (profile.role === 'parent') {
    return <ParentDashboard userData={profile} />
  }

  return <StudentDashboard userData={profile} />
}