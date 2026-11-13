import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'

export default function SystemBanner() {
  const [notes, setNotes] = useState([])

  useEffect(() => {
    const q = query(
      collection(db, 'systemNotifications'),
      where('active', '==', true)
    )
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  if (notes.length === 0) return null

  return (
    <div className="system-banner">
      {notes.map((note) => (
        <div key={note.id} className="system-note">
          <strong>System Notification</strong>
          <span>{note.message}</span>
        </div>
      ))}
    </div>
  )
}
