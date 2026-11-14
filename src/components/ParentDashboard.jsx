import { useState, useEffect, useMemo } from 'react'
import { auth, db } from '../firebase'
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore'
import SystemBanner from './SystemBanner'
import Profile from './Profile'
import AppShell from './AppShell'
import { useToast } from './FeedbackProvider'
import { linkChild, linkErrorMessage } from '../utils/parentLink'

const isGraded = (hw) => hw?.graded !== false
const todayStr = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

function StatusChip({ row }) {
  if (row.status === 'graded')
    return (
      <span className="chip green dot">
        Graded {row.sub.grade}/{row.max}
      </span>
    )
  if (row.status === 'done')
    return <span className="chip amber dot">{row.graded ? 'Submitted' : 'Done'}</span>
  if (row.status === 'overdue')
    return <span className="chip" style={{ color: '#dc2626' }}>Overdue</span>
  return <span className="chip">Not started</span>
}

export default function ParentDashboard({ userData }) {
  const toast = useToast()
  const uid = auth.currentUser?.uid
  const [tab, setTab] = useState('homework')
  const [children, setChildren] = useState([])
  const [childrenLoaded, setChildrenLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [child, setChild] = useState(null)
  const [classInfo, setClassInfo] = useState({ name: '', groups: {} })
  const [homework, setHomework] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [openId, setOpenId] = useState(null)
  const [pin, setPin] = useState('')
  const [childName, setChildName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const activeId =
    children.find((c) => c.studentId === selectedId)?.studentId ||
    children[0]?.studentId ||
    null
  const classId = child?.classId || null
  const groupId = child?.groupId || null

  // The children this parent has linked.
  useEffect(() => {
    if (!uid) return
    return onSnapshot(
      query(collection(db, 'parentChildren'), where('parentId', '==', uid)),
      (snap) => {
        setChildren(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
        )
        setChildrenLoaded(true)
      },
      () => setChildrenLoaded(true)
    )
  }, [uid])

  // The selected child's profile.
  useEffect(() => {
    setChild(null)
    setHomework([])
    setAnnouncements([])
    setSubmissions([])
    if (!activeId) return
    return onSnapshot(
      doc(db, 'users', activeId),
      (snap) => setChild(snap.exists() ? snap.data() : null),
      () => {}
    )
  }, [activeId])

  // The selected child's class content.
  useEffect(() => {
    if (!activeId || !classId) return
    const unsubs = []

    unsubs.push(
      onSnapshot(
        doc(db, 'classes', classId),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data()
            setClassInfo({ name: d.name || '', groups: d.groups || {} })
          }
        },
        () => {}
      )
    )

    const mergeDocs = (snaps) => {
      const map = new Map()
      snaps.forEach((docs) => {
        if (!docs) return
        docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }))
      })
      return Array.from(map.values()).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      )
    }

    // Same targeting the student sees: everyone, plus the child's own group.
    const subscribeTargeted = (collName, setter) => {
      const snaps = []
      const update = () => setter(mergeDocs(snaps))
      unsubs.push(
        onSnapshot(
          query(
            collection(db, collName),
            where('classId', '==', classId),
            where('groupIds', 'array-contains', '*')
          ),
          (s) => {
            snaps[0] = s.docs
            update()
          },
          () => {}
        )
      )
      if (groupId) {
        unsubs.push(
          onSnapshot(
            query(
              collection(db, collName),
              where('classId', '==', classId),
              where('groupIds', 'array-contains', groupId)
            ),
            (s) => {
              snaps[1] = s.docs
              update()
            },
            () => {}
          )
        )
      }
    }

    subscribeTargeted('homework', setHomework)
    subscribeTargeted('announcements', setAnnouncements)

    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'submissions'),
          where('studentId', '==', activeId),
          where('classId', '==', classId)
        ),
        (snap) => setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}
      )
    )

    return () => unsubs.forEach((u) => u())
  }, [activeId, classId, groupId])

  const targetLabel = (groupIds) => {
    const ids = groupIds || []
    if (ids.length === 0 || ids.includes('*')) return 'Everyone'
    return ids.map((id) => classInfo.groups[id] || 'Unknown group').join(', ')
  }

  const rows = useMemo(() => {
    const t = todayStr()
    return homework.map((hw) => {
      const sub = submissions.find((s) => s.homeworkId === hw.id)
      const max = hw.maxGrade || 100
      const status =
        sub?.status === 'graded'
          ? 'graded'
          : sub
          ? 'done'
          : hw.dueDate && hw.dueDate < t
          ? 'overdue'
          : 'todo'
      const pct =
        status === 'graded' && sub.grade != null
          ? Math.round((sub.grade / max) * 1000) / 10
          : null
      return { hw, sub, graded: isGraded(hw), max, status, pct }
    })
  }, [homework, submissions])

  const stats = useMemo(() => {
    const gradedRows = rows.filter((r) => r.status === 'graded' && r.pct != null)
    return {
      todo: rows.filter((r) => r.status === 'todo').length,
      overdue: rows.filter((r) => r.status === 'overdue').length,
      done: rows.filter((r) => r.status === 'done' || r.status === 'graded').length,
      waiting: rows.filter((r) => r.status === 'done' && r.graded).length,
      gradedRows,
      average: gradedRows.length
        ? Math.round((gradedRows.reduce((a, r) => a + r.pct, 0) / gradedRows.length) * 10) / 10
        : null,
    }
  }, [rows])

  const addChild = async (e) => {
    e.preventDefault()
    setAddError('')
    setAdding(true)
    try {
      const studentId = await linkChild(db, uid, pin, childName)
      setPin('')
      setChildName('')
      setSelectedId(studentId)
      setTab('homework')
      toast('Child added', 'success')
    } catch (err) {
      setAddError(
        linkErrorMessage(err) || 'Could not add your child. Check your connection and try again.'
      )
    } finally {
      setAdding(false)
    }
  }

  if (!childrenLoaded) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }

  const noChildren = children.length === 0
  const view = noChildren && tab !== 'profile' ? 'children' : tab
  const openRow = rows.find((r) => r.hw.id === openId) || null

  const nav = [
    {
      label: 'Your child',
      items: [
        { id: 'homework', label: 'Homework', badge: stats.todo + stats.overdue },
        { id: 'grades', label: 'Grades' },
        { id: 'announcements', label: 'Announcements' },
      ],
    },
    {
      label: 'Family',
      items: [
        { id: 'children', label: 'Children' },
        { id: 'profile', label: 'Profile' },
      ],
    },
  ]

  const addForm = (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="card-title">{noChildren ? 'Add your child' : 'Add another child'}</div>
          <div className="card-sub">
            Ask your child for their parent PIN. It is in their Profile tab.
          </div>
        </div>
      </div>
      {addError && (
        <div className="note error" style={{ marginBottom: 16 }}>
          {addError}
        </div>
      )}
      <form onSubmit={addChild}>
        <div className="grid grid-2">
          <div className="field">
            <label>Parent PIN (6 digits)</label>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
          <div className="field">
            <label>Child&apos;s username</label>
            <input
              className="input"
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              required
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={adding}>
          {adding ? 'Adding...' : 'Add child'}
        </button>
      </form>
    </div>
  )

  return (
    <AppShell
      userData={userData}
      nav={nav}
      active={view}
      onNavigate={setTab}
      title={child?.username || 'Parent'}
      subtitle={
        view === 'homework'
          ? `${stats.todo + stats.overdue} to do · ${classInfo.name || 'Class'}`
          : view === 'grades'
          ? 'Marks so far'
          : view === 'announcements'
          ? 'Messages from the teacher'
          : view === 'children'
          ? 'Link your children'
          : 'Your account'
      }
      actions={
        children.length > 1 ? (
          <select
            className="input"
            value={activeId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {children.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.studentUsername}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      <SystemBanner />

      {view === 'homework' && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 18 }}>
            <div className="stat accent">
              <div className="stat-label">To do</div>
              <div className="stat-value">{stats.todo + stats.overdue}</div>
              <div className="stat-note">of {rows.length}</div>
            </div>
            <div className="stat green">
              <div className="stat-label">Done</div>
              <div className="stat-value">{stats.done}</div>
              <div className="stat-note">{stats.waiting} waiting for a grade</div>
            </div>
            <div className="stat">
              <div className="stat-label">Average</div>
              <div className="stat-value">{stats.average != null ? stats.average : '—'}</div>
              <div className="stat-note">percent</div>
            </div>
            <div className="stat amber">
              <div className="stat-label">Overdue</div>
              <div className="stat-value">{stats.overdue}</div>
              <div className="stat-note">not handed in</div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Homework</div>
                <div className="card-sub">Tap one to see the details</div>
              </div>
            </div>
            {rows.length === 0 ? (
              <div className="empty">No homework assigned yet</div>
            ) : (
              <div className="list">
                {rows.map((r) => (
                  <div
                    key={r.hw.id}
                    className="row"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setOpenId(r.hw.id)}
                  >
                    <div className="row-main">
                      <div className="row-title">{r.hw.title}</div>
                      <div className="row-meta">
                        Due {r.hw.dueDate} · {r.graded ? `${r.max} points` : 'Not graded'}
                      </div>
                      <div className="row-badges">
                        <span className="chip accent">{targetLabel(r.hw.groupIds)}</span>
                        <StatusChip row={r} />
                        {r.pct != null && <span className="chip">{r.pct}%</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {view === 'grades' && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Grades</div>
              <div className="card-sub">
                {stats.gradedRows.length} graded · average{' '}
                {stats.average != null ? `${stats.average}%` : '—'} · {stats.waiting} waiting
              </div>
            </div>
          </div>
          {stats.gradedRows.length === 0 ? (
            <div className="empty">Nothing graded yet</div>
          ) : (
            <div className="list">
              {stats.gradedRows.map((r) => (
                <div key={r.hw.id} className="row">
                  <div className="row-main">
                    <div className="row-title">{r.hw.title}</div>
                    <div className="row-meta">
                      Due {r.hw.dueDate} · out of {r.max}
                    </div>
                  </div>
                  <div className="row-actions">
                    <span className="chip">{r.pct}%</span>
                    <span className="chip green dot">
                      {r.sub.grade}/{r.max}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'announcements' && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Announcements</div>
              <div className="card-sub">From the teacher</div>
            </div>
          </div>
          {announcements.length === 0 ? (
            <div className="empty">No announcements yet</div>
          ) : (
            <div className="list">
              {announcements.map((ann) => (
                <div key={ann.id} className="row">
                  <div className="row-main">
                    <div className="row-title">{ann.title}</div>
                    <div className="row-meta">{ann.message}</div>
                    <div className="row-badges">
                      <span className="chip accent">{targetLabel(ann.groupIds)}</span>
                      <span className="chip">
                        {new Date(ann.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'children' && (
        <>
          {!noChildren && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">
                <div className="card-title">Your children</div>
              </div>
              <div className="list">
                {children.map((c) => (
                  <div key={c.studentId} className="row">
                    <div className="row-main">
                      <div className="row-title">{c.studentUsername}</div>
                    </div>
                    <div className="row-actions">
                      {c.studentId === activeId ? (
                        <span className="chip green dot">Viewing</span>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setSelectedId(c.studentId)
                            setTab('homework')
                          }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {addForm}
        </>
      )}

      {view === 'profile' && <Profile userData={userData} className="" />}

      {openRow && (
        <div className="modal-overlay" onClick={() => setOpenId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{openRow.hw.title}</h3>
            <div className="field">
              <div className="stat-label">Homework</div>
              <p style={{ lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {openRow.hw.description || 'No description provided.'}
              </p>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <div className="stat-label">Due date</div>
                <div>{openRow.hw.dueDate || '—'}</div>
              </div>
              <div className="field">
                <div className="stat-label">Maximum points</div>
                <div>{openRow.graded ? openRow.max : 'Not graded'}</div>
              </div>
            </div>
            <div className="row-badges" style={{ marginBottom: 6 }}>
              <span className="chip accent">{targetLabel(openRow.hw.groupIds)}</span>
              <StatusChip row={openRow} />
              {openRow.pct != null && <span className="chip">{openRow.pct}%</span>}
            </div>
            {openRow.sub?.submittedAt && (
              <div className="row-meta">
                Handed in {new Date(openRow.sub.submittedAt).toLocaleString()}
              </div>
            )}
            <div style={{ marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => setOpenId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}