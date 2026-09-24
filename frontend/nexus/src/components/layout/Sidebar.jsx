import { NavLink } from 'react-router-dom'
import { useAuthentication } from '../../features/authentication/use-authentication'
import { useOperationsSocket } from '../../features/realtime/use-operations-socket'
import { canWorkTickets, UserRole } from '../../features/tickets/ticket-types'
import { useNotifications } from '../../features/notifications/use-notifications'
import nexusLogo from '../../assets/Nexus Logo.png'
import dashboardIcon from '../../assets/Dashboard.svg'
import myTicketsIcon from '../../assets/mytickets.svg'
import ticketPoolIcon from '../../assets/ticketspool.svg'
import chatsIcon from '../../assets/Chats.svg'
import managementIcon from '../../assets/management.svg'
import logsIcon from '../../assets/logs.svg'
import handoffsIcon from '../../assets/handoffs.svg'
import { NavIcon } from './NavIcon'

export function Sidebar({ open, onNavigate }) {
  const { user, logoutCurrentSession } = useAuthentication()
  const { connectionState } = useOperationsSocket()
  const { unreadChats, unclaimedTickets } = useNotifications()
  const showWorkQueues = canWorkTickets(user)
  const showAdministration = user?.role === UserRole.ADMIN

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <div className="sidebar-brand">
        <img className="brand-mark" src={nexusLogo} alt="" aria-hidden="true" />
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
          <NavIcon src={dashboardIcon} crop="dashboard" />
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
          <NavIcon src={myTicketsIcon} crop="mytickets" />
          My Tickets
        </NavLink>
        <NavLink
          to="/chats"
          className={({ isActive }) =>
            `nav-item ${isActive ? 'is-active' : ''}`
          }
          onClick={onNavigate}
        >
          <NavIcon src={chatsIcon} crop="chats" />
          Chats {unreadChats > 0 ? <span className="nav-notification-badge">{unreadChats > 99 ? '99+' : unreadChats}</span> : null}
        </NavLink>
        <NavLink
          to="/assistant"
          className={({ isActive }) =>
            'nav-item ' + (isActive ? 'is-active' : '')
          }
          onClick={onNavigate}
        >
          <span className="nav-ai-icon" aria-hidden="true">✦</span>
          Assistant
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
              <NavIcon src={ticketPoolIcon} crop="ticketpool" />
              Ticket Pools {unclaimedTickets > 0 ? <span className="nav-notification-badge">{unclaimedTickets > 99 ? '99+' : unclaimedTickets}</span> : null}
            </NavLink>
            <NavLink
              to="/tickets/handoffs"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'is-active' : ''}`
              }
              onClick={onNavigate}
            >
              <NavIcon src={handoffsIcon} crop="handoffs" />
              Handoffs
            </NavLink>
          </>
        ) : null}

        {showAdministration ? (
          <>
            <NavLink to="/admin/management" className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} onClick={onNavigate}>
              <NavIcon src={managementIcon} crop="management" />
              Management
            </NavLink>
            <NavLink to="/admin/logs" className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} onClick={onNavigate}>
              <NavIcon src={logsIcon} crop="logs" />
              Logs
            </NavLink>
          </>
        ) : null}
      </nav>

      <div className="sidebar-account">
        <div>
          <p className="sidebar-account-name">
            <span
              className={`sidebar-connection-dot is-${connectionState}`}
              role="status"
              aria-label={`Live updates ${connectionState}`}
            />
            {user?.fullName ?? 'Signed in'}
          </p>
          <span>{user?.email}</span>
        </div>
        <button type="button" className="sidebar-logout" onClick={logoutCurrentSession}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
