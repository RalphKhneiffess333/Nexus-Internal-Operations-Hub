import { NavLink } from 'react-router-dom'
import { useAuthentication } from '../../features/authentication/use-authentication'

export function Sidebar({ open, onNavigate }) {
  const { user, logoutCurrentSession } = useAuthentication()

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <div className="sidebar-brand">
        <span className="brand-mark" aria-hidden="true">
          N
        </span>
        <span className="brand-name">Nexus</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        <NavLink
          to="/tickets"
          className={({ isActive }) =>
            `nav-item ${isActive ? 'is-active' : ''}`
          }
          onClick={onNavigate}
        >
          <span className="nav-icon" aria-hidden="true">
            ▣
          </span>
          Tickets
        </NavLink>
      </nav>

      <div className="sidebar-account">
        <div>
          <p>{user?.fullName ?? 'Signed in'}</p>
          <span>{user?.email}</span>
        </div>
        <button type="button" className="sidebar-logout" onClick={logoutCurrentSession}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
