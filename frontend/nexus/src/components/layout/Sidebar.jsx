import { NavLink } from 'react-router-dom'
import { useAuthentication } from '../../features/authentication/use-authentication'
import { canWorkTickets } from '../../features/tickets/ticket-types'

export function Sidebar({ open, onNavigate }) {
  const { user, logoutCurrentSession } = useAuthentication()
  const showWorkQueues = canWorkTickets(user)
  const showAdministration = user?.role === 'Admin'

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
          to="/dashboard"
          className={({ isActive }) =>
            `nav-item ${isActive ? 'is-active' : ''}`
          }
          end
          onClick={onNavigate}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/tickets"
          className={({ isActive }) =>
            `nav-item ${isActive ? 'is-active' : ''}`
          }
          end
          onClick={onNavigate}
        >
          My tickets
        </NavLink>

        {showWorkQueues ? (
          <>
            <NavLink
              to="/tickets/pool"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'is-active' : ''}`
              }
              onClick={onNavigate}
            >
              Ticket pools
            </NavLink>
            <NavLink
              to="/tickets/handoffs"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'is-active' : ''}`
              }
              onClick={onNavigate}
            >
              Handoffs
            </NavLink>
          </>
        ) : null}

        {showAdministration ? (
          <>
            <NavLink to="/admin/management" className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} onClick={onNavigate}>
              Management
            </NavLink>
            <NavLink to="/admin/logs" className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} onClick={onNavigate}>
              Logs
            </NavLink>
          </>
        ) : null}
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
