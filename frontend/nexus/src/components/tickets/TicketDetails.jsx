import { departmentLabel } from '../../features/departments/use-departments'
import { formatDate, TicketPriority } from '../../features/tickets/ticket-types'
import { TicketStatusBadge } from './TicketStatusBadge'
import { TicketAttachments } from './TicketAttachments'
import { UserLink } from '../users/UserLink'

const PRIORITY_LABELS = {
  [TicketPriority.LOW]: 'Low',
  [TicketPriority.MODERATE]: 'Moderate',
  [TicketPriority.HIGH]: 'High',
}

function DetailRow({ label, value, supplemental }) {
  if (
    (value === null || value === undefined || value === '') &&
    !supplemental
  ) {
    return null
  }

  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>
        {value}
        {supplemental}
      </dd>
    </div>
  )
}

export function TicketDetails({
  ticket,
  departments = [],
  timelineOpen = true,
  onToggleTimeline,
  attachments = [],
  downloadingAttachmentId,
  onOpenAttachment,
  onDownloadAttachment,
}) {
  const submitted = formatDate(ticket.createdAt)
  const updated = formatDate(ticket.updatedAt)
  const closed = formatDate(ticket.closedAt)
  return (
    <article className="ticket-details clay-card content-reveal">
      <div className="ticket-details-heading">
        <div>
          <p className="ticket-code">{ticket.ticketCode}</p>
          <h1>{ticket.title}</h1>
        </div>
        {onToggleTimeline ? (
          <button
            type="button"
            className="btn ghost timeline-toggle"
            aria-expanded={timelineOpen}
            aria-controls={timelineOpen ? 'ticket-timeline' : undefined}
            onClick={onToggleTimeline}
          >
            {timelineOpen ? 'Hide timeline' : 'Show timeline'}
          </button>
        ) : null}
      </div>
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
        <DetailRow
          label="Assigned agent"
          value={ticket.agent ? <UserLink user={ticket.agent} /> : undefined}
        />
        <DetailRow
          label="Completion notes"
          value={ticket.completionNotes}
          supplemental={
            ticket.status === 'CLOSED' && attachments.length > 0 ? (
              <TicketAttachments
                attachments={attachments}
                heading="Files attached to completion notes"
                downloadingAttachmentId={downloadingAttachmentId}
                onOpen={onOpenAttachment}
                onDownload={onDownloadAttachment}
              />
            ) : null
          }
        />
        <DetailRow label="Closed" value={closed} />
      </dl>

      <section className="detail-block">
        <h2>Description</h2>
        <p>{ticket.description}</p>
        {ticket.status !== 'CLOSED' ? (
          <TicketAttachments
            attachments={attachments}
            heading="Files attached to description"
            downloadingAttachmentId={downloadingAttachmentId}
            onOpen={onOpenAttachment}
            onDownload={onDownloadAttachment}
          />
        ) : null}
      </section>

      <dl className="detail-grid">
        <DetailRow
          label="Submitted by"
          value={<UserLink user={ticket.submittedBy} />}
        />
        <DetailRow label="Submitted" value={submitted} />
        <DetailRow label="Last updated" value={updated} />
      </dl>
    </article>
  )
}
