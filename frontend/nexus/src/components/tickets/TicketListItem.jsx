import { Link, useLocation } from 'react-router-dom'
import { departmentLabel } from '../../features/departments/use-departments'
import { formatDate, TicketPriority } from '../../features/tickets/ticket-types'
import { TicketStatusBadge } from './TicketStatusBadge'

const PRIORITY_LABELS = {
  [TicketPriority.LOW]: 'Low',
  [TicketPriority.MODERATE]: 'Moderate',
  [TicketPriority.HIGH]: 'High',
}

export function TicketListItem({ ticket, departments = [] }) {
  const location = useLocation()

  return (
    <Link
      to={`/tickets/${ticket.ticketId}`}
      state={{ from: `${location.pathname}${location.search}` }}
      className={`ticket-row ticket-row-${ticket.status?.toLowerCase() ?? 'unknown'}`}
    >
      <div className="ticket-row-top">
        <span className="ticket-code">{ticket.ticketCode}</span>
        <TicketStatusBadge status={ticket.status} />
      </div>
      <h3 className="ticket-row-title">{ticket.title}</h3>
      <dl className="ticket-row-meta">
        <div>
          <dt>Priority</dt>
          <dd>{PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{departmentLabel(ticket.departmentId, departments)}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{formatDate(ticket.createdAt)}</dd>
        </div>
      </dl>
    </Link>
  )
}
