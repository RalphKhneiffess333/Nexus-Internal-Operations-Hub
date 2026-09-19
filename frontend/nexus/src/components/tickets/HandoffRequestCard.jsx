import { Link } from 'react-router-dom'
import { formatDateTime, HandoffStatus } from '../../features/tickets/ticket-types'

const STATUS_LABELS = {
  [HandoffStatus.PENDING]: 'Pending',
  [HandoffStatus.ACCEPTED]: 'Accepted',
  [HandoffStatus.REJECTED]: 'Rejected',
  [HandoffStatus.CANCELLED]: 'Cancelled',
}

export function HandoffRequestCard({
  handoff,
  currentUserId,
  mode = 'ticket',
  busy = false,
  onAccept,
  onReject,
  onCancel,
}) {
  const incoming = handoff.requestedAgent?.userId === currentUserId
  const outgoing = handoff.requester?.userId === currentUserId
  const canManage = handoff.status === HandoffStatus.PENDING && !busy
  const otherParty = incoming ? handoff.requester : handoff.requestedAgent
  const actionLabel = incoming ? 'Requested by' : 'Requested from'

  return (
    <article className={`handoff-card handoff-card-${handoff.status.toLowerCase()}`}>
      <div className="handoff-card-heading">
        <div>
          <p className="eyebrow">{STATUS_LABELS[handoff.status] ?? handoff.status}</p>
          <h3>{handoff.ticket?.ticketCode} · {handoff.ticket?.title}</h3>
        </div>
        <time dateTime={handoff.createdAt}>{formatDateTime(handoff.createdAt)}</time>
      </div>

      <dl className="handoff-card-details">
        <div>
          <dt>{actionLabel}</dt>
          <dd>{otherParty?.fullName ?? 'Unknown user'}</dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{handoff.ticket?.department?.name ?? 'Unknown department'}</dd>
        </div>
        <div>
          <dt>Current agent</dt>
          <dd>{handoff.ticket?.currentAgent?.fullName ?? 'Unassigned'}</dd>
        </div>
      </dl>

      {handoff.message ? <p className="handoff-card-message">“{handoff.message}”</p> : null}

      <div className="handoff-card-actions">
        {mode !== 'ticket' ? (
          <Link
            className="btn ghost"
            to={`/tickets/${handoff.ticket.ticketId}`}
            state={{ from: '/tickets/handoffs' }}
          >
            View ticket
          </Link>
        ) : null}
        {incoming && canManage ? (
          <>
            <button type="button" className="btn primary" onClick={() => onAccept(handoff)}>
              Accept
            </button>
            <button type="button" className="btn ghost" onClick={() => onReject(handoff)}>
              Reject
            </button>
          </>
        ) : null}
        {outgoing && canManage ? (
          <button type="button" className="btn ghost" onClick={() => onCancel(handoff)}>
            Cancel request
          </button>
        ) : null}
      </div>
    </article>
  )
}
