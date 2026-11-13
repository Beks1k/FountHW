import { useState, useEffect, useMemo } from 'react'
import { db } from '../firebase'
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore'
import ReviewQueue from './ReviewQueue'
import { useToast, useConfirm } from './FeedbackProvider'

export default function AdminPanel({ userData }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState('review')
  const [users, setUsers] = useState([])
  const [classes, setClasses] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [notifications, setNotifications] = useState([])
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    const unsubNotes = onSnapshot(
      collection(db, 'systemNotifications'),
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }
    )
    const unsubClasses = onSnapshot(collection(db, 'classes'), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    const unsubSubs = onSnapshot(collection(db, 'submissions'), (snap) => {
      setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => {
      unsubUsers()
      unsubNotes()
      unsubClasses()
      unsubSubs()
    }
  }, [])

  const toggleBan = async (user) => {
    if (user.email === userData.email) return
    const action = user.banned ? 'Unban' : 'Ban'
    const ok = await confirm({
      title: `${action} ${user.username}?`,
      message: user.banned
        ? 'This account will be able to sign in again.'
        : 'This account will be locked out immediately.',
      confirmLabel: action,
      danger: !user.banned,
    })
    if (!ok) return
    try {
      await updateDoc(doc(db, 'users', user.id), { banned: !user.banned })
      toast(`${user.username} ${user.banned ? 'unbanned' : 'banned'}`, 'success')
    } catch (err) {
      setError(err.message)
    }
  }

  const clearWarning = async (user, undo = false) => {
    try {
      await updateDoc(doc(db, 'users', user.id), {
        warningsCleared: !undo,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  const backfillGroups = async () => {
    const ok = await confirm({
      title: 'Fix old homework and announcements?',
      message:
        'Anything posted before groups existed gets the "everyone" target so students can see it.',
      confirmLabel: 'Fix them',
    })
    if (!ok) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      let count = 0
      for (const collName of ['homework', 'announcements']) {
        const snap = await getDocs(collection(db, collName))
        for (const d of snap.docs) {
          if (!d.data().groupIds) {
            await updateDoc(doc(db, collName, d.id), { groupIds: ['*'] })
            count++
          }
        }
      }
      setNotice(
        count > 0
          ? `Updated ${count} item(s) so every student can see them.`
          : 'Everything was already up to date.'
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const sendNotification = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    try {
      await addDoc(collection(db, 'systemNotifications'), {
        message: message.trim(),
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: userData.email,
      })
      setMessage('')
      toast('Broadcast sent to everyone', 'success')
    } catch (err) {
      setError(err.message)
    }
  }

  const toggleNotification = async (note) => {
    try {
      await updateDoc(doc(db, 'systemNotifications', note.id), {
        active: !note.active,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteNotification = async (note) => {
    const ok = await confirm({
      title: 'Remove this notification?',
      message: 'It will disappear from every user immediately.',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    try {
      await deleteDoc(doc(db, 'systemNotifications', note.id))
      toast('Notification removed', 'success')
    } catch (err) {
      setError(err.message)
    }
  }

  const classMap = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c])),
    [classes]
  )

  const groups = useMemo(() => {
    const term = search.toLowerCase()
    const matching = users.filter(
      (u) =>
        (u.username || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term)
    )

    const byClass = new Map()
    matching.forEach((u) => {
      const key = u.classId || 'no-class'
      if (!byClass.has(key)) byClass.set(key, [])
      byClass.get(key).push(u)
    })

    const list = Array.from(byClass.entries()).map(([classId, members]) => ({
      classId,
      name:
        classId === 'no-class'
          ? 'No class'
          : classMap[classId]?.name || 'Unknown class',
      pin: classId === 'no-class' ? null : classMap[classId]?.pin,
      members: members.slice().sort((a, b) => {
        if (a.role !== b.role) return a.role === 'teacher' ? -1 : 1
        return (a.username || a.email || '').localeCompare(
          b.username || b.email || ''
        )
      }),
    }))

    list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [users, search, classMap])

  const banned = useMemo(
    () =>
      users
        .filter((u) => u.banned)
        .slice()
        .sort((a, b) => (a.username || a.email || '').localeCompare(b.username || b.email || '')),
    [users]
  )

  return (
    <div>
      {error && <div className="note error">{error}</div>}
      {notice && <div className="note ok">{notice}</div>}

      <div className="admin-tabs">
        <button
          className={tab === 'review' ? 'active' : ''}
          onClick={() => setTab('review')}
        >
          Review
        </button>
        <button
          className={tab === 'users' ? 'active' : ''}
          onClick={() => setTab('users')}
        >
          Users ({users.length})
        </button>
        <button
          className={tab === 'banned' ? 'active' : ''}
          onClick={() => setTab('banned')}
        >
          Banned ({banned.length})
        </button>
        <button
          className={tab === 'broadcast' ? 'active' : ''}
          onClick={() => setTab('broadcast')}
        >
          Broadcasts
        </button>
        <button
          className={tab === 'maintenance' ? 'active' : ''}
          onClick={() => setTab('maintenance')}
        >
          Maintenance
        </button>
      </div>

      {tab === 'review' && (
        <div className="card">
          <h3>Review accounts</h3>
          <p className="card-hint">
            Accounts worth a second look. Work down the list and ban anything
            that is not a real student of yours.
          </p>
          <ReviewQueue
            users={users}
            classes={classes}
            submissions={submissions}
            userData={userData}
            onBan={toggleBan}
            onClear={clearWarning}
          />
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="card">
          <h3>Maintenance</h3>
          <p className="card-hint">
            Homework and announcements posted before groups existed have no
            target, so students cannot see them. This gives them the
            &quot;everyone&quot; target.
          </p>
          <button
            className="btn btn-primary"
            onClick={backfillGroups}
            disabled={busy}
          >
            {busy ? 'Working...' : 'Fix old homework and announcements'}
          </button>
        </div>
      )}

      {tab === 'broadcast' && (
        <div className="card">
          <h3>System Notification</h3>
          <form onSubmit={sendNotification}>
            <div className="field">
              <textarea
                className="input"
                rows={3}
                placeholder="Message shown to all users..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Broadcast
            </button>
          </form>

          {notifications.length > 0 && (
            <div className="admin-notifications">
              <h4 className="admin-subheading">Sent notifications</h4>
              {notifications.map((note) => (
                <div key={note.id} className="admin-note">
                  <div className="admin-note-msg">{note.message}</div>
                  <div className="admin-note-actions">
                    <span
                      className={`status-badge ${
                        note.active ? 'status-done' : 'status-pending'
                      }`}
                    >
                      {note.active ? 'Showing' : 'Hidden'}
                    </span>
                    <button
                      className="btn btn-grade btn-sm"
                      onClick={() => toggleNotification(note)}
                    >
                      {note.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ background: '#fee2e2', color: '#dc2626' }}
                      onClick={() => deleteNotification(note)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'banned' && (
        <div className="card">
          <h3>Banned accounts ({banned.length})</h3>
          <p className="card-hint">
            Locked out immediately and cannot sign in. Unban to let them back in.
          </p>

          {banned.length === 0 && (
            <div className="empty">No banned accounts</div>
          )}

          {banned.map((u) => (
            <div key={u.id} className="admin-user">
              <div className="admin-user-info">
                <span className="admin-user-name">
                  {u.username || '(no username)'}
                </span>
                <span className="admin-user-email">{u.email}</span>
                <span className="admin-user-meta">
                  {u.role} ·{' '}
                  {u.classId
                    ? classMap[u.classId]?.name || 'Unknown class'
                    : 'No class'}{' '}
                  ·{' '}
                  {u.createdAt
                    ? new Date(u.createdAt).toLocaleDateString()
                    : 'unknown date'}
                </span>
              </div>
              <div className="admin-user-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ background: '#d1fae5', color: '#059669' }}
                  onClick={() => toggleBan(u)}
                >
                  Unban
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (

        <div className="card">
          <h3>Users ({users.length})</h3>
          <div className="field">
            <div className="search-field">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                className="input"
                type="text"
                placeholder="Search by username or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {groups.length === 0 && (
            <div className="empty">No users found</div>
          )}

          {groups.map((group) => (
            <div key={group.classId} className="admin-group">
              <div className="admin-group-header">
                <span className="admin-group-name">{group.name}</span>
                <span className="admin-group-meta">
                  {group.members.length}{' '}
                  {group.members.length === 1 ? 'member' : 'members'}
                  {group.pin ? ` · PIN ${group.pin}` : ''}
                </span>
              </div>

              {group.members.map((u) => (
                <div key={u.id} className="admin-user">
                  <div className="admin-user-info">
                    <span className="admin-user-name">
                      {u.username || '(no username)'}
                      {u.email === userData.email && (
                        <span className="admin-tag">you</span>
                      )}
                    </span>
                    <span className="admin-user-email">{u.email}</span>
                    <span className="admin-user-meta">
                      {u.role} ·{' '}
                      {u.domainVerified ? 'domain ok' : 'unverified'}{' '}
                      ·{' '}
                      {u.groupId && classMap[u.classId]?.groups?.[u.groupId]
                        ? `group: ${classMap[u.classId].groups[u.groupId]}`
                        : 'no group'}{' '}
                      ·{' '}
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString()
                        : 'unknown date'}
                    </span>
                  </div>
                  <div className="admin-user-actions">
                    {u.banned && (
                      <span className="status-badge status-pending">Banned</span>
                    )}
                    {u.email !== userData.email && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={
                          u.banned
                            ? { background: '#d1fae5', color: '#059669' }
                            : { background: '#fee2e2', color: '#dc2626' }
                        }
                        onClick={() => toggleBan(u)}
                      >
                        {u.banned ? 'Unban' : 'Ban'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
