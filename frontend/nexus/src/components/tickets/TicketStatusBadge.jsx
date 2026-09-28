import { TicketStatus } from '../../features/tickets/ticket-types'

const LABELS = {
  [TicketStatus.OPEN]: 'Open',
  [TicketStatus.CLAIMED]: 'Claimed',
  [TicketStatus.CLOSED]: 'Closed',
  [TicketStatus.REOPENED]: 'Reopened',
}

export function TicketStatusBadge({ status, active = true }) {
  const displayStatus = active === false ? 'CANCELLED' : status

  return (
    <span className={`status-badge status-${displayStatus?.toLowerCase()}`}>
      {displayStatus === 'CANCELLED' ? 'Cancelled' : LABELS[status] ?? status}
    </span>
  )
}
