import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '../Sidebar/Sidebar'
import layoutStyles from '../Layout.module.css'
import notificationStyles from '../../notifications/Notifications.module.css'
import responsiveStyles from '../../../styles/responsive.module.css'
import sharedStyles from '../../../styles/shared.module.css'
import nexusLogo from '../../../assets/Nexus Logo.png'

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const isTicketChat = location.pathname.startsWith('/chats/')

  return (
    <div className={[
      'app-shell',
      layoutStyles.moduleAnchor,
      notificationStyles.moduleAnchor,
      responsiveStyles.moduleAnchor,
      sharedStyles.moduleAnchor,
    ].join(' ')}>
      {menuOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />

      <div className="app-main">
        <header className="mobile-bar">
          <button
            type="button"
            className="menu-button"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <span className="mobile-title"><img src={nexusLogo} alt="" aria-hidden="true" />Nexus</span>
        </header>
        <main className={`page-frame${isTicketChat ? ' page-frame-chat' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

