import { useState, useEffect, useMemo } from 'react'
import { auth, db } from '../firebase'
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
} from 'firebase/firestore'
import SystemBanner from './SystemBanner'
import Profile from './Profile'
import { useToast } from './FeedbackProvider'
import AppShell from './AppShell'

export default function StudentDashboard({ userData }) {
  const toast = useToast()
  const [tab, setTab] = useState('homework')
  const [homework, setHomework] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [submittedHwIds, setSubmittedHwIds] = useState(new Set())
  const [classInfo, setClassInfo] = useState({ name: '', groups: {} })
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  

  useEffect(() => {
    if (!userData.classId) return
    const unsubs = []

    unsubs.push(
      onSnapshot(doc(db, 'classes', userData.classId), (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setClassInfo({ name: d.name || '', groups: d.groups || {} })
        }
      })
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

    const subscribeTargeted = (collName, setter) => {
      const everyone = query(
        collection(db, collName),
        where('classId', '==', userData.classId),
        where('groupIds', 'array-contains', '*')
      )
      const snaps = []
      const update = () => setter(mergeDocs(snaps))
      const list = [
        onSnapshot(everyone, (s) => {
          snaps[0] = s.docs
          update()
        }),
      ]
      if (userData.groupId) {
        const mine = query(
          collection(db, collName),
          where('classId', '==', userData.classId),
          where('groupIds', 'array-contains', userData.groupId)
        )
        list.push(
          onSnapshot(mine, (s) => {
            snaps[1] = s.docs
            update()
          })
        )
      }
      return list
    }

    unsubs.push(...subscribeTargeted('homework', setHomework))
    unsubs.push(...subscribeTargeted('announcements', setAnnouncements))

    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'submissions'),
          where('classId', '==', userData.classId),
          where('studentId', '==', auth.currentUser.uid)
        ),
        (snap) => {
          setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        }
      )
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [userData.classId, userData.groupId])

  const markDone = async (hwId) => {
    if (submittedHwIds.has(hwId)) return
    setSubmittedHwIds((prev) => new Set(prev).add(hwId))
    try {
      await addDoc(collection(db, 'submissions'), {
        homeworkId: hwId,
        classId: userData.classId,
        studentId: auth.currentUser.uid,
        studentName: userData.username,
        status: 'done',
        submittedAt: new Date().toISOString(),
        grade: null,
      })
      toast('Marked as done', 'success')
    } catch (err) {
      // Undo the optimistic flag so the button comes back.
      setSubmittedHwIds((prev) => {
        const next = new Set(prev)
        next.delete(hwId)
        return next
      })
      toast('Could not save that. Check your connection and try again.', 'error')
    }
  }

  const getSubmissionForHw = (hwId) =>
    submissions.find((s) => s.homeworkId === hwId) ||
    submittedHwIds.has(hwId)

  // Old homeworks have no "graded" field, so anything except an explicit false counts as graded.
  const isGraded = (hw) => hw?.graded !== false
  const selectedHw = homework.find((h) => h.id === selectedId) || null

  const myGroupName = userData.groupId ? classInfo.groups[userData.groupId] : null

  const targetLabel = (groupIds) => {
    const ids = groupIds || []
    if (ids.length === 0 || ids.includes('*')) return 'Everyone'
    return ids.map((id) => classInfo.groups[id] || 'Unknown group').join(', ')
  }

  const pending = useMemo(
    () => homework.filter((hw) => getSubmissionForHw(hw.id)?.status !== 'graded' && !getSubmissionForHw(hw.id)),
    [homework, submissions, submittedHwIds]
  )
  const done = useMemo(
    () => homework.filter((hw) => {
      const s = getSubmissionForHw(hw.id)
      return s && s.status
    }),
    [homework, submissions, submittedHwIds]
  )
  const graded = useMemo(
    () => submissions.filter((s) => s.status === 'graded'),
    [submissions]
  )

  const average = useMemo(() => {
    if (graded.length === 0) return null
    const sum = graded.reduce((acc, s) => {
      const hw = homework.find((h) => h.id === s.homeworkId)
      const max = hw?.maxGrade || 100
      return acc + (s.grade / max) * 100
    }, 0)
    return Math.round((sum / graded.length) * 10) / 10
  }, [graded, homework])

  const nextDue = useMemo(() => {
    const undated = pending
      .map((hw) => hw.dueDate)
      .filter(Boolean)
      .sort()
    if (undated.length === 0) return null
    const days = Math.ceil(
      (new Date(undated[0]).getTime() - Date.now()) / 86400000
    )
    return { label: days <= 0 ? 'Today' : days === 1 ? '1d' : `${days}d`, title: undated[0] }
  }, [pending])

  const nav = [
    {
      label: 'Class',
      items: [
        { id: 'homework', label: 'Homework', badge: pending.length },
        { id: 'announcements', label: 'Announcements' },
        { id: 'grades', label: 'Grades' },
      ],
    },
    { label: 'You', items: [{ id: 'profile', label: 'Profile' }] },
  ]

  return (
    <AppShell
      userData={userData}
      nav={nav}
      active={tab}
      onNavigate={setTab}
      title={classInfo.name || 'Class'}
      subtitle={
        tab === 'homework'
          ? `${pending.length} task${pending.length === 1 ? '' : 's'} left`
          : tab === 'announcements'
          ? 'Messages from your teacher'
          : 'Your marks so far'
      }
      actions={
        myGroupName ? <span className="chip accent dot">{myGroupName}</span> : null
      }
    >
      <SystemBanner />

      {tab === 'homework' && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 18 }}>
            <div className="stat accent">
              <div className="stat-label">To do</div>
              <div className="stat-value">{pending.length}</div>
              <div className="stat-note">of {homework.length}</div>
            </div>
            <div className="stat green">
              <div className="stat-label">Done</div>
              <div className="stat-value">{done.length}</div>
              <div className="stat-note">this term</div>
            </div>
            <div className="stat">
              <div className="stat-label">Average</div>
              <div className="stat-value">{average != null ? average : '—'}</div>
              <div className="stat-note">percent</div>
            </div>
            <div className="stat amber">
              <div className="stat-label">Next due</div>
              <div className="stat-value">{nextDue ? nextDue.label : '—'}</div>
              <div className="stat-note">
                {nextDue ? new Date(nextDue.title).toLocaleDateString() : 'nothing due'}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Homework</div>
                <div className="card-sub">Only what is for your group</div>
              </div>
              <div className="chip">{pending.length} pending</div>
            </div>

            {homework.length === 0 ? (
              <div className="empty">No homework assigned yet</div>
            ) : (
              <div className="list">
            {homework.map((hw) => {
              const sub = getSubmissionForHw(hw.id)
              const max = hw.maxGrade || 100
              const isHovered = hoveredId === hw.id

              return (
                <div
                  key={hw.id}
                  className="row"
                  onClick={() => setSelectedId(hw.id)}
                  onMouseEnter={() => setHoveredId(hw.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 10,
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                    transform: isHovered ? 'translateY(-2px)' : 'none',
                  }}
                >
                      <div className="row-main">
                        <div className="row-title">{hw.title}</div>
                        <div className="row-meta">
                          Due {hw.dueDate} · {isGraded(hw) ? `${max} points` : 'Not graded'}
                        </div>
                        {hw.description && (
                          <div
                            className="row-meta"
                            style={{
                              marginTop: 4,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {hw.description}
                          </div>
                        )}
                        <div className="row-badges">
                          <span className="chip accent">{targetLabel(hw.groupIds)}</span>
                          {sub?.status === 'graded' ? (
                            <span className="chip green dot">
                              Graded {sub.grade}/{max}
                            </span>
                          ) : sub?.status === 'done' ? (
                            <span className="chip amber dot">Submitted</span>
                          ) : (
                            <span className="chip">Not started</span>
                          )}
                        </div>
                      </div>
                      {!sub?.status && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            markDone(hw.id)
                          }}
                        >
                          Mark done
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'announcements' && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Announcements</div>
              <div className="card-sub">From your teacher</div>
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

      {tab === 'profile' && (
        <Profile userData={userData} className={classInfo.name} />
      )}

      {tab === 'grades' && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Your grades</div>
              <div className="card-sub">
                {graded.length} graded · average {average != null ? `${average}%` : '—'}
              </div>
            </div>
          </div>

          {graded.length === 0 ? (
            <div className="empty">
              Nothing graded yet. Your teacher will mark your work as it comes in.
            </div>
          ) : (
            <div className="list">
              {graded.map((sub) => {
                const hw = homework.find((h) => h.id === sub.homeworkId)
                const max = hw?.maxGrade || 100
                return (
                  <div key={sub.id} className="row">
                    <div className="row-main">
                      <div className="row-title">{hw?.title || 'Homework'}</div>
                      <div className="row-meta">
                        {targetLabel(hw?.groupIds)} · out of {max}
                      </div>
                    </div>
                    <div className="row-actions">
                      <span className="chip green dot">
                        {sub.grade}/{max}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {selectedHw && (() => {
        const sub = getSubmissionForHw(selectedHw.id)
        const graded = isGraded(selectedHw)
        const max = selectedHw.maxGrade || 100
        return (
          <div className="modal-overlay" onClick={() => setSelectedId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{selectedHw.title}</h3>

              <div className="field">
                <div className="stat-label">Homework</div>
                <p style={{ lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  {selectedHw.description || 'No description provided.'}
                </p>
              </div>

              <div className="grid grid-2">
                <div className="field">
                  <div className="stat-label">Due date</div>
                  <div>{selectedHw.dueDate || '—'}</div>
                </div>
                <div className="field">
                  <div className="stat-label">Maximum points</div>
                  <div>{graded ? max : 'Not graded'}</div>
                </div>
              </div>

              <div className="row-badges" style={{ marginBottom: 6 }}>
                <span className="chip accent">{targetLabel(selectedHw.groupIds)}</span>
                {sub?.status === 'graded' ? (
                  <span className="chip green dot">
                    Graded {sub.grade}/{max}
                  </span>
                ) : sub ? (
                  <span className="chip amber dot">Submitted</span>
                ) : (
                  <span className="chip">Not started</span>
                )}
              </div>

              <div style={{ marginTop: 18 }}>
                {!sub && (
                  <button
                    className="btn btn-primary"
                    onClick={() => markDone(selectedHw.id)}
                  >
                    Mark as done
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => setSelectedId(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </AppShell>
  )
}
