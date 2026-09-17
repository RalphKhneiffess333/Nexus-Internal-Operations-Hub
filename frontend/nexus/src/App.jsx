import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { RippleEffect } from './components/ui/RippleEffect'
import { useAuthentication } from './features/authentication/use-authentication'
import { LandingPage } from './pages/authentication/LandingPage'
import { NewTicketPage } from './pages/tickets/NewTicketPage'
import { TicketDetailsPage } from './pages/tickets/TicketDetailsPage'
import { TicketsPage } from './pages/tickets/TicketsPage'

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
    content = <LandingPage />
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
