import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { RealtimeConnectionIndicator } from '../ui/RealtimeConnectionIndicator'

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
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
          <span className="mobile-title">Nexus</span>
        </header>
        <main className="page-frame">
          <Outlet />
        </main>
      </div>
      <RealtimeConnectionIndicator />
    </div>
  )
}
