import ThemeToggle from './ThemeToggle'
import useSignOut from '../hooks/useSignOut'

const ICONS = {
  homework: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  ),
  announcements: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l18-7-7 18-3-8-8-3z" />
    </svg>
  ),
  groups: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M17 11h4M19 9v4" />
    </svg>
  ),
  grades: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 2 18h20L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  ),
}

function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function AppShell({
  userData,
  nav,
  active,
  onNavigate,
  title,
  subtitle,
  actions,
  children,
}) {
  const allItems = nav.flatMap((g) => g.items)
  const signOutUser = useSignOut()

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          FountHW
        </div>

        {nav.map((group) => (
          <div key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map((item) => (
              <div
                key={item.id}
                className={`nav-item ${active === item.id ? 'on' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                {ICONS[item.id]}
                <span>{item.label}</span>
                {item.badge > 0 && <span className="nav-pill">{item.badge}</span>}
              </div>
            ))}
          </div>
        ))}

        <div className="side-foot">
          <div className="user-chip" style={{ marginBottom: 12 }}>
            <div className="avatar">{initials(userData.username)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="user-chip-name">{userData.username}</div>
              <div className="user-chip-sub">
                {userData.role === 'teacher' ? 'Teacher' : 'Student'}
              </div>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: '100%' }}
            onClick={signOutUser}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="page-head">
          <div style={{ minWidth: 0 }}>
            <div className="page-title">{title}</div>
            {subtitle && <div className="page-sub">{subtitle}</div>}
          </div>
          <div className="head-actions">
            {actions}
            <ThemeToggle />
            <button
              className="icon-btn icon-danger"
              onClick={signOutUser}
              title="Sign out"
              aria-label="Sign out"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
        {children}
      </main>

      <nav className="bottom-nav">
        {allItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${active === item.id ? 'on' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {ICONS[item.id]}
            <span>{item.label}</span>
            {item.badge > 0 && <span className="nav-pill">{item.badge}</span>}
          </div>
        ))}
      </nav>
    </div>
  )
}
