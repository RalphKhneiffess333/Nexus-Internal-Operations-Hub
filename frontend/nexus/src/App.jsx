import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { NewTicketPage } from './pages/tickets/NewTicketPage'
import { TicketDetailsPage } from './pages/tickets/TicketDetailsPage'
import { TicketsPage } from './pages/tickets/TicketsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/tickets" replace />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/new" element={<NewTicketPage />} />
        <Route path="/tickets/:ticketId" element={<TicketDetailsPage />} />
      </Route>
    </Routes>
  )
}
