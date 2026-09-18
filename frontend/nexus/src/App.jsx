import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { RippleEffect } from './components/ui/RippleEffect'
import { useAuthentication } from './features/authentication/use-authentication'
import { LandingPage } from './pages/authentication/LandingPage'
import { NewTicketPage } from './pages/tickets/NewTicketPage'
import { TicketDetailsPage } from './pages/tickets/TicketDetailsPage'
import { TicketsPage } from './pages/tickets/TicketsPage'
import { ManagementPage } from './pages/administration/ManagementPage'
import { LogsPage } from './pages/administration/LogsPage'
import { UserRole } from './features/tickets/ticket-types'

function AdminRoute({ children }) {
  const { user } = useAuthentication()
  return user?.role === UserRole.ADMIN ? children : <Navigate to="/tickets" replace />
}

export default function App() {
  const { authenticated, loading } = useAuthentication()

  let content

  if (loading) {
    content = (
      <main className="auth-loading">
        <div className="auth-loading-mark">N</div>
        <p>Checking your session...</p>
      </main>
    )
  } else if (!authenticated) {
    content = (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  } else {
    content = (
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="/tickets" element={<TicketsPage view="submitted" />} />
          <Route
            path="/tickets/department"
            element={<Navigate to="/tickets/pool?view=all" replace />}
          />
          <Route path="/tickets/pool" element={<TicketsPage view="pool" />} />
          <Route path="/tickets/all" element={<AdminRoute><Navigate to="/tickets/pool?view=system" replace /></AdminRoute>} />
          <Route path="/admin/management" element={<AdminRoute><ManagementPage /></AdminRoute>} />
          <Route path="/admin/logs" element={<AdminRoute><LogsPage /></AdminRoute>} />
          <Route path="/tickets/new" element={<NewTicketPage />} />
          <Route path="/tickets/:ticketId" element={<TicketDetailsPage />} />
        </Route>
      </Routes>
    )
  }

  return (
    <>
      <RippleEffect />
      {content}
    </>
  )
}
