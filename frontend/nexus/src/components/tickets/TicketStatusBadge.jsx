import { TICKET_STATUS_LABELS } from '../../features/tickets/ticket-types'

export function TicketStatusBadge({ status, active = true }) {
  const displayStatus = active === false ? 'CANCELLED' : status

  return (
    <span className={`status-badge status-${displayStatus?.toLowerCase()}`}>
      {displayStatus === 'CANCELLED' ? 'Cancelled' : TICKET_STATUS_LABELS[status] ?? status}
    </span>
  )
}
