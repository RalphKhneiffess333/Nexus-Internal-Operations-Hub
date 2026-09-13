import { NavLink } from 'react-router-dom'
import { useAuthentication } from '../../features/authentication/use-authentication'
import { canWorkTickets } from '../../features/tickets/ticket-types'

export function Sidebar({ open, onNavigate }) {
  const { user, logoutCurrentSession } = useAuthentication()
  const showWorkQueues = canWorkTickets(user)

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
          end
          onClick={onNavigate}
        >
          <span className="nav-icon" aria-hidden="true">
            ▣
          </span>
          My tickets
        </NavLink>

        {showWorkQueues ? (
          <>
            <NavLink
              to="/tickets/department"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'is-active' : ''}`
              }
              onClick={onNavigate}
            >
              <span className="nav-icon" aria-hidden="true">
                ◫
              </span>
              Department
            </NavLink>
            <NavLink
              to="/tickets/pool"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'is-active' : ''}`
              }
              onClick={onNavigate}
            >
              <span className="nav-icon" aria-hidden="true">
                ⊞
              </span>
              Ticket pool
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
