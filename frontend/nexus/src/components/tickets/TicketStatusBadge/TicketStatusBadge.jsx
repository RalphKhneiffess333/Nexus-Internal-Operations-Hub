import { TicketStatus } from '../../../features/tickets/ticket-types'

const LABELS = {
  [TicketStatus.OPEN]: 'Open',
  [TicketStatus.CLAIMED]: 'Claimed',
  [TicketStatus.CLOSED]: 'Closed',
  [TicketStatus.REOPENED]: 'Reopened',
}

export function TicketStatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status?.toLowerCase()}`}>
      {LABELS[status] ?? status}
    </span>
  )
}


