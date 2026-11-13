import { useState, useEffect } from 'react'
import { db } from '../firebase'
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore'
import { useToast, useConfirm } from './FeedbackProvider'

export default function GroupManager({ classId, groups, onChanged }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [students, setStudents] = useState([])
  const [newGroupName, setNewGroupName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'users'), where('classId', '==', classId))
    const unsub = onSnapshot(q, (snap) => {
      setStudents(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => u.role === 'student')
      )
    })
    return () => unsub()
  }, [classId])

  const groupList = Object.entries(groups || {})

  const writeGroups = async (next) => {
    await updateDoc(doc(db, 'classes', classId), { groups: next })
    onChanged()
  }

  const addGroup = async (e) => {
    e.preventDefault()
    const name = newGroupName.trim()
    if (!name) return
    if (
      groupList.some(([, n]) => n.toLowerCase() === name.toLowerCase())
    ) {
      setError('A group with that name already exists')
      return
    }
    const id = `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    setError('')
    try {
      await writeGroups({ ...(groups || {}), [id]: name })
      setNewGroupName('')
      toast('Group created', 'success')
    } catch (err) {
      setError(err.message)
    }
  }

  const renameGroup = async (id) => {
    const name = await confirm({
      title: 'Rename group',
      message: `This group is currently called "${groups[id]}".`,
      confirmLabel: 'Rename',
      danger: false,
      input: {
        label: 'New group name',
        value: groups[id],
        placeholder: 'Group A',
        maxLength: 60,
      },
    })
    if (!name) return
    const trimmed = name.trim()
    if (!trimmed) return
    if (trimmed === groups[id]) return
    if (
      groupList.some(
        ([gid, n]) => gid !== id && n.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setError('A group with that name already exists')
      return
    }
    setError('')
    try {
      await writeGroups({ ...groups, [id]: trimmed })
      toast('Group renamed', 'success')
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteGroup = async (id) => {
    const ok = await confirm({
      title: `Delete group "${groups[id]}"?`,
      message: 'Students in this group will become unassigned.',
      confirmLabel: 'Delete group',
    })
    if (!ok) return
    const next = { ...groups }
    delete next[id]
    setError('')
    try {
      await writeGroups(next)
      for (const s of students.filter((s) => s.groupId === id)) {
        await updateDoc(doc(db, 'users', s.id), { groupId: null })
      }
      toast('Group deleted', 'success')
    } catch (err) {
      setError(err.message)
    }
  }

  const assign = async (student, groupId) => {
    setError('')
    try {
      await updateDoc(doc(db, 'users', student.id), { groupId: groupId || null })
    } catch (err) {
      setError(err.message)
    }
  }

  const membersOf = (groupId) =>
    students.filter((s) => (s.groupId || null) === (groupId || null))

  return (
    <div>
      {error && <div className="note error">{error}</div>}

      <div className="card">
        <h3>Groups</h3>
        <p className="card-hint">
          Split your class into groups. You can target homework and
          announcements at one group or several.
        </p>

        <form onSubmit={addGroup} className="group-add-form">
          <input
            className="input"
            type="text"
            placeholder="New group name, e.g. Group A"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-inline">
            Add Group
          </button>
        </form>

        {groupList.length === 0 && (
          <div className="empty">
            No groups yet. Create one above to start splitting the class.
          </div>
        )}

        {groupList.map(([id, name]) => (
          <div key={id} className="group-block">
            <div className="group-header">
              <span className="group-name">{name}</span>
              <span className="group-count">
                {membersOf(id).length}{' '}
                {membersOf(id).length === 1 ? 'student' : 'students'}
              </span>
              <div className="group-actions">
                <button
                  className="btn btn-grade btn-sm"
                  onClick={() => renameGroup(id)}
                >
                  Rename
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ background: '#fee2e2', color: '#dc2626' }}
                  onClick={() => deleteGroup(id)}
                >
                  Delete
                </button>
              </div>
            </div>

            {membersOf(id).length === 0 && (
              <div className="group-empty">No students in this group</div>
            )}

            {membersOf(id).map((s) => (
              <div key={s.id} className="group-member">
                <span className="group-member-name">
                  {s.username || s.email}
                </span>
                <select
                  className="group-select"
                  value={s.groupId || ''}
                  onChange={(e) => assign(s, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {groupList.map(([gid, gname]) => (
                    <option key={gid} value={gid}>
                      {gname}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ))}

        {students.length > 0 && (
          <div className="group-block">
            <div className="group-header">
              <span className="group-name">Unassigned students</span>
              <span className="group-count">{membersOf(null).length}</span>
            </div>
            {membersOf(null).length === 0 && (
              <div className="group-empty">Every student is in a group</div>
            )}
            {membersOf(null).map((s) => (
              <div key={s.id} className="group-member">
                <span className="group-member-name">
                  {s.username || s.email}
                </span>
                <select
                  className="group-select"
                  value=""
                  onChange={(e) => assign(s, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {groupList.map(([gid, gname]) => (
                    <option key={gid} value={gid}>
                      {gname}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
