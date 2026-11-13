import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { db } from '../firebase'
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore'
import SystemBanner from './SystemBanner'
import GroupManager from './GroupManager'
import GroupTargetPicker from './GroupTargetPicker'
import Profile from './Profile'
import { copyToClipboard } from '../utils/clipboard'
import { useToast, useConfirm } from './FeedbackProvider'
import AppShell from './AppShell'
import { ADMIN_EMAIL } from '../config'

const AdminPanel = lazy(() => import('./AdminPanel'))

export default function TeacherDashboard({ userData }) {
  const [tab, setTab] = useState('homework')
  const [homework, setHomework] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [students, setStudents] = useState([])
  const [classInfo, setClassInfo] = useState({ name: '', groups: {} })
  const [showCreateHw, setShowCreateHw] = useState(false)
  const [showCreateAnn, setShowCreateAnn] = useState(false)
  const [hwTitle, setHwTitle] = useState('')
  const [hwDesc, setHwDesc] = useState('')
  const [hwDue, setHwDue] = useState('')
  const [hwMaxGrade, setHwMaxGrade] = useState(100)
  const [hwGraded, setHwGraded] = useState(true)
  const [hwGroups, setHwGroups] = useState([])
  const [annTitle, setAnnTitle] = useState('')
  const [annMsg, setAnnMsg] = useState('')
  const [annGroups, setAnnGroups] = useState([])
  const [grades, setGrades] = useState({})

  const isAdmin = userData.email === ADMIN_EMAIL
  const toast = useToast()
  const confirm = useConfirm()

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

    unsubs.push(
      onSnapshot(
        query(collection(db, 'homework'), where('classId', '==', userData.classId)),
        (snap) => {
          setHomework(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
          )
        }
      )
    )

    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'announcements'),
          where('classId', '==', userData.classId)
        ),
        (snap) => {
          setAnnouncements(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
          )
        }
      )
    )

    unsubs.push(
      onSnapshot(
        query(collection(db, 'submissions'), where('classId', '==', userData.classId)),
        (snap) => {
          setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        }
      )
    )

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users'), where('classId', '==', userData.classId)),
        (snap) => {
          setStudents(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((u) => u.role === 'student')
          )
        }
      )
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [userData.classId])

  const createHomework = async (e) => {
    e.preventDefault()
    try {
      await addDoc(collection(db, 'homework'), {
        classId: userData.classId,
        title: hwTitle,
        description: hwDesc,
        dueDate: hwDue,
        graded: hwGraded,
        maxGrade: hwGraded ? Number(hwMaxGrade) : null,
        groupIds: hwGroups.length ? hwGroups : ['*'],
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      toast('Could not post the homework. Try again.', 'error')
      return
    }
    setHwTitle('')
    setHwDesc('')
    setHwDue('')
    setHwMaxGrade(100)
    setHwGraded(true)
    setHwGroups([])
    setShowCreateHw(false)
  }

  const deleteHomework = async (hwId) => {
    const ok = await confirm({
      title: 'Delete this homework?',
      message: 'The homework and every submission for it will be removed.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const subsSnapshot = await getDocs(
      query(collection(db, 'submissions'), where('homeworkId', '==', hwId))
    )
    await Promise.all(subsSnapshot.docs.map((d) => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'homework', hwId))
    toast('Homework deleted', 'success')
  }

  const createAnnouncement = async (e) => {
    e.preventDefault()
    try {
      await addDoc(collection(db, 'announcements'), {
        classId: userData.classId,
        title: annTitle,
        message: annMsg,
        groupIds: annGroups.length ? annGroups : ['*'],
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      toast('Could not post the announcement. Try again.', 'error')
      return
    }
    setAnnTitle('')
    setAnnMsg('')
    setAnnGroups([])
    setShowCreateAnn(false)
  }

  const deleteAnnouncement = async (annId) => {
    const ok = await confirm({
      title: 'Delete this announcement?',
      message: 'Students will no longer see it.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    await deleteDoc(doc(db, 'announcements', annId))
    toast('Announcement deleted', 'success')
  }

  const gradeSubmission = async (subId, maxGrade) => {
    const grade = grades[subId]
    const num = parseInt(grade)
    if (isNaN(num) || num < 0 || num > maxGrade) {
      toast(`Enter a grade between 0 and ${maxGrade}.`, 'error')
      return
    }
    try {
      await updateDoc(doc(db, 'submissions', subId), {
        grade: num,
        status: 'graded',
      })
    } catch (err) {
      toast('Could not save the grade. Try again.', 'error')
    }
  }

  const getSubmissionsForHw = (hwId) =>
    submissions.filter((s) => s.homeworkId === hwId)

  const targetLabel = (groupIds) => {
    const ids = groupIds || []
    if (ids.length === 0 || ids.includes('*')) return 'Everyone'
    return ids.map((id) => classInfo.groups[id] || 'Unknown group').join(', ')
  }

  // Old homeworks have no "graded" field, so anything except an explicit false counts as graded.
  const isGraded = (hw) => hw?.graded !== false

  const toGrade = submissions.filter((s) => {
    if (s.status !== 'done') return false
    const hw = homework.find((h) => h.id === s.homeworkId)
    return isGraded(hw)
  }).length

  const classAverage = useMemo(() => {
    const graded = submissions.filter((s) => s.status === 'graded' && s.grade != null)
    if (graded.length === 0) return null
    const sum = graded.reduce((acc, s) => {
      const hw = homework.find((h) => h.id === s.homeworkId)
      const max = hw?.maxGrade || 100
      return acc + (s.grade / max) * 100
    }, 0)
    return Math.round((sum / graded.length) * 10) / 10
  }, [submissions, homework])

  const nav = [
    {
      label: 'Manage',
      items: [
        { id: 'homework', label: 'Homework' },
        { id: 'announcements', label: 'Announcements' },
        { id: 'groups', label: 'Groups' },
      ],
    },
    ...(isAdmin
      ? [{ label: 'Account', items: [{ id: 'admin', label: 'Admin' }] }]
      : []),
    { label: 'You', items: [{ id: 'profile', label: 'Profile' }] },
  ]

  const actions = useMemo(() => {
    if (tab === 'homework') {
      return (
        <button className="btn btn-primary" onClick={() => setShowCreateHw(true)}>
          + New homework
        </button>
      )
    }
    if (tab === 'announcements') {
      return (
        <button className="btn btn-primary" onClick={() => setShowCreateAnn(true)}>
          + New announcement
        </button>
      )
    }
    return null
  }, [tab])

  return (
    <AppShell
      userData={userData}
      nav={nav}
      active={tab}
      onNavigate={setTab}
      title={classInfo.name || 'Class'}
      subtitle={
        tab === 'homework'
          ? `${students.length} student${students.length === 1 ? '' : 's'} · ${Object.keys(classInfo.groups).length} group${
              Object.keys(classInfo.groups).length === 1 ? '' : 's'
            }`
          : tab === 'announcements'
          ? 'Messages for your class'
          : tab === 'groups'
          ? 'Split your class and target your work'
          : 'Administrator tools'
      }
      actions={actions}
    >
      <SystemBanner />

      {tab === 'homework' && (
        <>
          {userData.classPin && (
            <div
              className="pinbox"
              style={{
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div className="stat-label" style={{ marginBottom: 5 }}>
                  Class PIN — share with students
                </div>
                <div className="pin">{userData.classPin}</div>
              </div>
              <div className="hstack">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    const ok = await copyToClipboard(userData.classPin)
                    if (ok) {
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
                  Copy PIN
                </button>
                <div className="chip green dot">
                  {students.length} student{students.length === 1 ? '' : 's'} ·{' '}
                  {Object.keys(classInfo.groups).length} group
                  {Object.keys(classInfo.groups).length === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-4" style={{ marginBottom: 18 }}>
            <div className="stat">
              <div className="stat-label">Homework</div>
              <div className="stat-value">{homework.length}</div>
              <div className="stat-note">posted</div>
            </div>
            <div className="stat amber">
              <div className="stat-label">To grade</div>
              <div className="stat-value">{toGrade}</div>
              <div className="stat-note">waiting</div>
            </div>
            <div className="stat">
              <div className="stat-label">Students</div>
              <div className="stat-value">{students.length}</div>
              <div className="stat-note">
                {Object.keys(classInfo.groups).length} group
                {Object.keys(classInfo.groups).length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="stat green">
              <div className="stat-label">Class average</div>
              <div className="stat-value">
                {classAverage != null ? classAverage : '—'}
              </div>
              <div className="stat-note">percent</div>
            </div>
          </div>

          {homework.length === 0 && (
            <div className="card">
              <div className="empty">
                No homework yet. Post the first assignment to get started.
              </div>
            </div>
          )}

          {homework.map((hw) => {
            const subs = getSubmissionsForHw(hw.id)
            return (
              <div key={hw.id} className="card" style={{ marginBottom: 14 }}>
                <div className="card-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="card-title">{hw.title}</div>
                    <div className="card-sub">
                      Due {hw.dueDate} · {isGraded(hw) ? `${hw.maxGrade || 100} points` : 'Not graded'}
                    </div>
                  </div>
                  <div className="hstack">
                    <span className="chip accent">{targetLabel(hw.groupIds)}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => deleteHomework(hw.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem',
                    marginBottom: 14,
                    lineHeight: 1.55,
                  }}
                >
                  <strong>Homework: </strong>
                  {hw.description}
                </p>

                {subs.length === 0 ? (
                  <div className="empty" style={{ padding: 16 }}>
                    No submissions yet
                  </div>
                ) : (
                  <div className="list">
                    {subs.map((sub) => (
                      <div key={sub.id} className="row">
                        <div className="row-main">
                          <div className="row-title">{sub.studentName}</div>
                          <div className="row-meta">
                            {sub.status === 'graded'
                              ? `Graded ${sub.grade} / ${hw.maxGrade || 100}`
                              : sub.status === 'done'
                              ? (isGraded(hw) ? 'Submitted, waiting for a grade' : 'Marked as done')
                              : 'Pending'}
                          </div>
                        </div>
                        <div className="row-actions">
                          {!isGraded(hw) ? (
                            <span className="chip green dot">Done</span>
                          ) : sub.status === 'graded' ? (
                            <span className="chip green dot">
                              {sub.grade}/{hw.maxGrade || 100}
                            </span>
                          ) : (
                            <>
                              <input
                                className="input"
                                style={{ width: 96 }}
                                type="number"
                                min="0"
                                max={hw.maxGrade || 100}
                                placeholder={`/${hw.maxGrade || 100}`}
                                value={grades[sub.id] || ''}
                                onChange={(e) =>
                                  setGrades({ ...grades, [sub.id]: e.target.value })
                                }
                              />
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  gradeSubmission(sub.id, hw.maxGrade || 100)
                                }
                              >
                                Save
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {tab === 'announcements' && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Announcements</div>
              <div className="card-sub">Everyone in your class sees these</div>
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
                  <div className="row-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => deleteAnnouncement(ann.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'groups' && (
        <GroupManager
          classId={userData.classId}
          groups={classInfo.groups}
          onChanged={() => {}}
        />
      )}

      {tab === 'admin' && isAdmin && (
        <Suspense fallback={<div className="card"><div className="empty">Loading admin tools...</div></div>}>
          <AdminPanel userData={userData} />
        </Suspense>
      )}

      {tab === 'profile' && (
        <Profile userData={userData} className={classInfo.name} />
      )}

      {showCreateHw && (
        <div className="modal-overlay" onClick={() => setShowCreateHw(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New homework</h3>
            <form onSubmit={createHomework}>
              <div className="field">
                <label>Theme of the lesson</label>
                <input
                  className="input"
                  value={hwTitle}
                  onChange={(e) => setHwTitle(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Homework</label>
                <textarea
                  className="input"
                  rows={4}
                  value={hwDesc}
                  onChange={(e) => setHwDesc(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label>Due date</label>
                  <input
                    className="input"
                    type="date"
                    value={hwDue}
                    onChange={(e) => setHwDue(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label>Maximum points</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={hwGraded ? hwMaxGrade : ''}
                    disabled={!hwGraded}
                    onChange={(e) => setHwMaxGrade(e.target.value)}
                    required={hwGraded}
                  />
                </div>
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  margin: '4px 0 14px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={!hwGraded}
                  onChange={(e) => setHwGraded(!e.target.checked)}
                />
                <span>Do not grade this homework (no points)</span>
              </label>
              <GroupTargetPicker
                groups={classInfo.groups}
                value={hwGroups}
                onChange={setHwGroups}
              />
              <div style={{ marginTop: 18 }}>
                <button type="submit" className="btn btn-primary">
                  Post homework
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreateHw(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateAnn && (
        <div className="modal-overlay" onClick={() => setShowCreateAnn(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New announcement</h3>
            <form onSubmit={createAnnouncement}>
              <div className="field">
                <label>Title</label>
                <input
                  className="input"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Message</label>
                <textarea
                  className="input"
                  rows={4}
                  value={annMsg}
                  onChange={(e) => setAnnMsg(e.target.value)}
                  required
                />
              </div>
              <GroupTargetPicker
                groups={classInfo.groups}
                value={annGroups}
                onChange={setAnnGroups}
              />
              <div style={{ marginTop: 18 }}>
                <button type="submit" className="btn btn-primary">
                  Post
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreateAnn(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
