import { NavLink } from 'react-router-dom'

export function Sidebar({ open, onNavigate }) {
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
    </aside>
  )
}
