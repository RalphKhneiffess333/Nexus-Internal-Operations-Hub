import { departmentLabel } from '../../features/departments/use-departments'
import { formatDate, TicketPriority } from '../../features/tickets/ticket-types'
import { TicketStatusBadge } from './TicketStatusBadge'

const PRIORITY_LABELS = {
  [TicketPriority.LOW]: 'Low',
  [TicketPriority.MODERATE]: 'Moderate',
  [TicketPriority.HIGH]: 'High',
}

function DetailRow({ label, value }) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function TicketDetails({ ticket, departments = [] }) {
  const submitted = formatDate(ticket.createdAt)
  const updated = formatDate(ticket.updatedAt)
  const closed = formatDate(ticket.closedAt)
  const submittedBy = ticket.submittedBy.fullName
  const assignedAgent = ticket.agent?.fullName

  return (
    <article className="ticket-details clay-card content-reveal">
      <p className="ticket-code">{ticket.ticketCode}</p>
      <h1>{ticket.title}</h1>
      <hr className="soft-rule" />

      <dl className="detail-grid">
        <div className="detail-row">
          <dt>Status</dt>
          <dd>
            <TicketStatusBadge status={ticket.status} />
          </dd>
        </div>
        <DetailRow
          label="Priority"
          value={PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
        />
        <DetailRow
          label="Department"
          value={departmentLabel(ticket.departmentId, departments)}
        />
        <DetailRow label="Assigned agent" value={assignedAgent} />
        <DetailRow label="Completion notes" value={ticket.completionNotes} />
        <DetailRow label="Closed" value={closed} />
      </dl>

      <section className="detail-block">
        <h2>Description</h2>
        <p>{ticket.description}</p>
      </section>

      <dl className="detail-grid">
        <DetailRow label="Submitted by" value={submittedBy} />
        <DetailRow label="Submitted" value={submitted} />
        <DetailRow label="Last updated" value={updated} />
      </dl>
    </article>
  )
}
