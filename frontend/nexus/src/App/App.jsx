import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell/AppShell'
import { RippleEffect } from '../components/ui/RippleEffect/RippleEffect'
import { useAuthentication } from '../features/authentication/use-authentication'
import { LandingPage } from '../pages/authentication/LandingPage/LandingPage'
import { NewTicketPage } from '../pages/tickets/NewTicketPage/NewTicketPage'
import { TicketDetailsPage } from '../pages/tickets/TicketDetailsPage/TicketDetailsPage'
import { HandoffsPage } from '../pages/tickets/HandoffsPage/HandoffsPage'
import { TicketsPage } from '../pages/tickets/TicketsPage/TicketsPage'
import { ManagementPage } from '../pages/administration/ManagementPage/ManagementPage'
import { LogsPage } from '../pages/administration/LogsPage/LogsPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage/DashboardPage'
import { ChatsPage } from '../pages/chats/ChatsPage/ChatsPage'
import { TicketChatPage } from '../pages/chats/TicketChatPage/TicketChatPage'
import { canWorkTickets, UserRole } from '../features/tickets/ticket-types'
import { NotFoundPage } from '../pages/NotFoundPage'

function AdminRoute({ children }) {
  const { user } = useAuthentication()
  return user?.role === UserRole.ADMIN ? children : <Navigate to="/tickets" replace />
}

function WorkQueueRoute({ children }) {
  const { user } = useAuthentication()
  return canWorkTickets(user) ? children : <Navigate to="/tickets" replace />
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
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    )
  } else {
    content = (
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/chats/:ticketId" element={<TicketChatPage />} />
          <Route path="/tickets" element={<TicketsPage view="submitted" />} />
          <Route
            path="/tickets/department"
            element={
              <WorkQueueRoute>
                <Navigate to="/tickets/pool?view=all" replace />
              </WorkQueueRoute>
            }
          />
          <Route
            path="/tickets/pool"
            element={
              <WorkQueueRoute>
                <TicketsPage view="pool" />
              </WorkQueueRoute>
            }
          />
          <Route
            path="/tickets/handoffs"
            element={
              <WorkQueueRoute>
                <HandoffsPage />
              </WorkQueueRoute>
            }
          />
          <Route path="/tickets/all" element={<AdminRoute><Navigate to="/tickets/pool?view=system" replace /></AdminRoute>} />
          <Route path="/admin/management" element={<AdminRoute><ManagementPage /></AdminRoute>} />
          <Route path="/admin/logs" element={<AdminRoute><LogsPage /></AdminRoute>} />
          <Route path="/tickets/new" element={<NewTicketPage />} />
          <Route path="/tickets/:ticketId" element={<TicketDetailsPage />} />
          <Route path="*" element={<NotFoundPage />} />
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

