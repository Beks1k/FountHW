import { useState, useMemo } from 'react'

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'mail.ru',
  'yandex.ru',
  'yandex.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'protonmail.com',
  'proton.me',
  'icloud.com',
  'me.com',
  'aol.com',
  'yahoo.com',
  'zoho.com',
  'gmx.de',
  'yandex.by',
  'inbox.ru',
  'bk.ru',
  'list.ru',
  'rambler.ru',
])

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

const SEVERITY_LABEL = {
  high: 'Needs a decision',
  medium: 'Worth checking',
  low: 'Minor',
}

function emailDomain(email) {
  if (!email) return ''
  const at = email.lastIndexOf('@')
  return at === -1 ? '' : email.slice(at + 1).toLowerCase()
}

export default function ReviewQueue({
  users,
  classes,
  submissions,
  userData,
  onBan,
  onClear,
}) {
  const [filter, setFilter] = useState('all')
  const [showCleared, setShowCleared] = useState(false)

  const classMap = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c])),
    [classes]
  )

  const activityByStudent = useMemo(() => {
    const map = new Map()
    submissions.forEach((s) => {
      map.set(s.studentId, (map.get(s.studentId) || 0) + 1)
    })
    return map
  }, [submissions])

  const flagged = useMemo(() => {
    const now = Date.now()
    return users
      .map((u) => {
        const warnings = []
        const domain = emailDomain(u.email)

        if (u.domainVerified !== true) {
          warnings.push({
            key: 'unverified-domain',
            severity: 'high',
            label: 'Email domain cannot receive mail',
            detail: domain
              ? `${domain} has no working mail server, so this address cannot exist.`
              : 'The email domain could not be verified at signup.',
          })
        }

        if (u.role === 'teacher' && u.email !== userData.email) {
          warnings.push({
            key: 'teacher-account',
            severity: 'medium',
            label: 'Teacher account',
            detail:
              'Anyone can sign up as a teacher. Confirm this is a real teacher of yours.',
          })
        }

        if (
          u.role === 'student' &&
          u.classId &&
          classMap[u.classId]?.groups &&
          Object.keys(classMap[u.classId].groups).length > 0 &&
          !u.groupId
        ) {
          warnings.push({
            key: 'unassigned-group',
            severity: 'low',
            label: 'Not in a group',
            detail: `Class "${classMap[u.classId]?.name || 'unknown'}" has groups but this student is not in one.`,
          })
        }

        if (FREE_EMAIL_DOMAINS.has(domain)) {
          warnings.push({
            key: 'free-email',
            severity: 'low',
            label: 'Personal email provider',
            detail: `${domain} is a free mailbox provider rather than a school address.`,
          })
        }

        const ageHours = u.createdAt
          ? (now - new Date(u.createdAt).getTime()) / 3600000
          : 0
        if (
          u.role === 'student' &&
          ageHours > 24 &&
          !activityByStudent.get(u.id)
        ) {
          warnings.push({
            key: 'no-activity',
            severity: 'low',
            label: 'Never submitted any homework',
            detail: `Joined ${Math.floor(ageHours / 24)} day(s) ago and has not submitted anything.`,
          })
        }

        return { user: u, warnings, domain }
      })
      .filter(
        (row) =>
          !row.user.banned && row.warnings.length > 0 && !row.user.warningsCleared
      )
      .sort((a, b) => {
        const sa = Math.min(
          ...a.warnings.map((w) => SEVERITY_ORDER[w.severity])
        )
        const sb = Math.min(
          ...b.warnings.map((w) => SEVERITY_ORDER[w.severity])
        )
        if (sa !== sb) return sa - sb
        return (a.user.createdAt || '').localeCompare(b.user.createdAt || '')
      })
  }, [users, classMap, activityByStudent, userData.email])

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 }
    flagged.forEach((row) => {
      row.warnings.forEach((w) => {
        c[w.severity]++
      })
    })
    return c
  }, [flagged])

  const visible = flagged.filter(
    (row) => filter === 'all' || row.warnings.some((w) => w.severity === filter)
  )

  const cleared = users.filter((u) => u.warningsCleared && !u.banned)
  const totalProblems = counts.high + counts.medium + counts.low

  if (users.length === 0) {
    return <div className="empty">No accounts to review yet</div>
  }

  return (
    <div>
      <div className="review-summary">
        <div className={`review-stat ${counts.high ? 'stat-high' : ''}`}>
          <span className="review-stat-num">{counts.high}</span>
          <span className="review-stat-label">Needs a decision</span>
        </div>
        <div className={`review-stat ${counts.medium ? 'stat-medium' : ''}`}>
          <span className="review-stat-num">{counts.medium}</span>
          <span className="review-stat-label">Worth checking</span>
        </div>
        <div className={`review-stat ${counts.low ? 'stat-low' : ''}`}>
          <span className="review-stat-num">{counts.low}</span>
          <span className="review-stat-label">Minor</span>
        </div>
      </div>

      <div className="review-filters">
        {['all', 'high', 'medium', 'low'].map((f) => (
          <button
            key={f}
            className={`review-filter ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : SEVERITY_LABEL[f]}
          </button>
        ))}
        {cleared.length > 0 && (
          <button
            className={`review-filter ${showCleared ? 'active' : ''}`}
            onClick={() => setShowCleared(!showCleared)}
          >
            Cleared ({cleared.length})
          </button>
        )}
      </div>

      {totalProblems === 0 && (
        <div className="empty">
          Nothing looks suspicious. Every account has a valid email domain.
        </div>
      )}

      {visible.map((row) => (
        <div key={row.user.id} className="review-item">
          <div className="review-item-head">
            <div className="review-item-name">
              <span className="review-item-username">
                {row.user.username || '(no username)'}
              </span>
              {row.user.email === userData.email && (
                <span className="admin-tag">you</span>
              )}
              <span className="review-item-email">{row.user.email}</span>
            </div>
            <div className="review-item-actions">
              <button
                className="btn btn-ghost btn-sm"
                style={{ background: '#d1fae5', color: '#059669' }}
                onClick={() => onClear(row.user)}
              >
                Looks fine
              </button>
              {(() => {
                if (row.user.banned || row.user.email === userData.email) {
                  return null
                }
                return (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ background: '#fee2e2', color: '#dc2626' }}
                    onClick={() => onBan(row.user)}
                  >
                    Ban
                  </button>
                )
              })()}
            </div>
          </div>

          <div className="review-warnings">
            {row.warnings.map((w) => (
              <div key={w.key} className={`review-warning warn-${w.severity}`}>
                <span className="review-warning-label">{w.label}</span>
                <span className="review-warning-detail">{w.detail}</span>
              </div>
            ))}
          </div>

          <div className="review-item-meta">
            {row.user.role} ·{' '}
            {row.user.classId
              ? classMap[row.user.classId]?.name || 'unknown class'
              : 'no class'}
          </div>
        </div>
      ))}
    </div>
  )
}
