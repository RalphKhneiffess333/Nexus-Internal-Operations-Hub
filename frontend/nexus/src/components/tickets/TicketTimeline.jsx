import { departmentLabel } from '../../features/departments/use-departments'
import {
  formatDateTime,
  TicketEventAction,
} from '../../features/tickets/ticket-types'

const EVENT_PRESENTATION = {
  [TicketEventAction.SUBMISSION]: {
    label: 'OPENED',
    summary: 'Ticket submitted',
  },
  [TicketEventAction.CLAIM]: {
    label: 'CLAIMED',
    summary: 'Ticket assigned to an agent',
  },
  [TicketEventAction.CLOSE]: {
    label: 'CLOSED',
    summary: 'Ticket marked as resolved',
  },
  [TicketEventAction.REOPEN]: {
    label: 'REOPENED',
    summary: 'Ticket returned to the queue',
  },
  [TicketEventAction.DELETE]: {
    label: 'CANCELLED',
    summary: 'Ticket cancelled',
  },
  [TicketEventAction.MODIFICATION]: {
    label: 'UPDATED',
    summary: 'Ticket details changed',
  },
  [TicketEventAction.HANDOFF]: {
    label: 'HANDOFF',
    summary: 'Ticket handoff updated',
  },
}

const PRIORITY_LABELS = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
}

function valueOrFallback(value) {
  if (value === null || value === undefined || value === '') {
    return 'Not provided'
  }

  return value
}

function userName(user) {
  return user?.fullName ?? 'Unknown user'
}

function DetailRow({ label, children }) {
  return (
    <div className="timeline-detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function ChangeRow({ label, before, after }) {
  if (before === after) {
    return null
  }

  return (
    <DetailRow label={label}>
      <span className="timeline-old-value">{valueOrFallback(before)}</span>
      <span className="timeline-change-arrow" aria-label="changed to">
        →
      </span>
      <span className="timeline-new-value">{valueOrFallback(after)}</span>
    </DetailRow>
  )
}

function EventDetails({ event, departments }) {
  const details = event.details ?? {}

  switch (event.action) {
    case TicketEventAction.SUBMISSION:
      return (
        <dl className="timeline-detail-grid">
          <DetailRow label="Title">{details.title}</DetailRow>
          <DetailRow label="Department">
            {departmentLabel(details.departmentId, departments)}
          </DetailRow>
          <DetailRow label="Priority">
            {PRIORITY_LABELS[details.priority] ?? details.priority}
          </DetailRow>
          <DetailRow label="Description">{details.description}</DetailRow>
          <DetailRow label="Submitted by">{userName(details.submitter)}</DetailRow>
        </dl>
      )

    case TicketEventAction.CLAIM:
      return (
        <dl className="timeline-detail-grid">
          <DetailRow label="Assigned agent">{userName(details.agent)}</DetailRow>
          <DetailRow label="Claimed at">
            {formatDateTime(details.timestamp)}
          </DetailRow>
        </dl>
      )

    case TicketEventAction.CLOSE:
      return (
        <dl className="timeline-detail-grid">
          <DetailRow label="Closed by">{userName(details.agent)}</DetailRow>
          <DetailRow label="Completion notes">
            {valueOrFallback(details.completionNotes)}
          </DetailRow>
        </dl>
      )

    case TicketEventAction.REOPEN:
      return (
        <dl className="timeline-detail-grid">
          <DetailRow label="Priority">
            {PRIORITY_LABELS[details.priority] ?? details.priority}
          </DetailRow>
          <DetailRow label="Updated description">
            {details.description}
          </DetailRow>
          <DetailRow label="Reopened by">{userName(details.submitter)}</DetailRow>
        </dl>
      )

    case TicketEventAction.DELETE:
      return (
        <dl className="timeline-detail-grid">
          <DetailRow label="Cancelled by">{userName(details.deletedBy)}</DetailRow>
        </dl>
      )

    case TicketEventAction.MODIFICATION:
      return (
        <dl className="timeline-detail-grid timeline-change-list">
          <ChangeRow
            label="Title"
            before={details.oldTitle}
            after={details.newTitle}
          />
          <ChangeRow
            label="Department"
            before={departmentLabel(details.oldDepartmentId, departments)}
            after={departmentLabel(details.newDepartmentId, departments)}
          />
          <ChangeRow
            label="Priority"
            before={PRIORITY_LABELS[details.oldPriority] ?? details.oldPriority}
            after={PRIORITY_LABELS[details.newPriority] ?? details.newPriority}
          />
          <ChangeRow
            label="Description"
            before={details.oldDescription}
            after={details.newDescription}
          />
        </dl>
      )

    case TicketEventAction.HANDOFF:
      return (
        <dl className="timeline-detail-grid">
          <DetailRow label="Handoff status">{details.action}</DetailRow>
          <DetailRow label="Requested by">{userName(details.requester)}</DetailRow>
          <DetailRow label="Requested agent">
            {userName(details.requestedAgent)}
          </DetailRow>
          <DetailRow label="Updated at">
            {formatDateTime(details.timestamp)}
          </DetailRow>
        </dl>
      )

    default:
      return <p className="timeline-detail-empty">No additional details.</p>
  }
}

function TimelineSkeleton() {
  return (
    <div className="timeline-skeleton" aria-label="Loading ticket timeline">
      {[0, 1, 2].map((item) => (
        <span key={item} />
      ))}
    </div>
  )
}

export function TicketTimeline({
  events,
  loading,
  error,
  selectedEvent,
  selectedEventId,
  detailLoading,
  detailError,
  departments = [],
  onSelect,
  onRetry,
}) {
  const orderedEvents = [...events].sort((left, right) => {
    const timestampDifference =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()

    return (
      timestampDifference ||
      left.ticketEventId.localeCompare(right.ticketEventId)
    )
  })

  return (
    <aside
      id="ticket-timeline"
      className="ticket-timeline clay-card content-reveal"
      aria-labelledby="timeline-heading"
    >
      <div className="timeline-heading">
        <div>
          <p className="eyebrow">Activity</p>
          <h2 id="timeline-heading">Ticket timeline</h2>
        </div>
        {!loading && !error ? (
          <span className="timeline-count" aria-label={`${orderedEvents.length} events`}>
            {orderedEvents.length}
          </span>
        ) : null}
      </div>

      <div>
        {loading ? <TimelineSkeleton /> : null}

        {!loading && error ? (
          <div className="timeline-state timeline-state-error">
            <p>{error}</p>
            <button type="button" className="btn ghost" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && orderedEvents.length === 0 ? (
          <div className="timeline-state">
            <p>No activity has been recorded for this ticket yet.</p>
          </div>
        ) : null}

        {!loading && !error && orderedEvents.length > 0 ? (
          <ol className="timeline-list">
            {orderedEvents.map((event) => {
              const presentation = EVENT_PRESENTATION[event.action] ?? {
                label: event.action,
                summary: 'Ticket activity recorded',
              }
              const isSelected = selectedEventId === event.ticketEventId
              const panelId = `timeline-event-${event.ticketEventId}`

              return (
                <li
                  key={event.ticketEventId}
                  className={`timeline-item timeline-${event.action.toLowerCase()}`}
                >
                  <span className="timeline-dot" aria-hidden="true" />
                  <div className={`timeline-entry${isSelected ? ' is-selected' : ''}`}>
                    <button
                      type="button"
                      className="timeline-trigger"
                      aria-expanded={isSelected}
                      aria-controls={panelId}
                      onClick={() => onSelect(event)}
                    >
                      <span className="timeline-entry-copy">
                        <strong>{presentation.label}</strong>
                        <span>{presentation.summary}</span>
                      </span>
                      <span className="timeline-entry-meta">
                        <time dateTime={event.createdAt}>
                          {formatDateTime(event.createdAt)}
                        </time>
                        <span className="timeline-chevron" aria-hidden="true">
                          ›
                        </span>
                      </span>
                    </button>

                    {isSelected ? (
                      <div id={panelId} className="timeline-detail-panel">
                        {detailLoading ? (
                          <p className="timeline-detail-status">Loading details…</p>
                        ) : null}
                        {!detailLoading && detailError ? (
                          <p className="timeline-detail-status timeline-detail-error">
                            {detailError}
                          </p>
                        ) : null}
                        {!detailLoading && !detailError && selectedEvent ? (
                          <>
                            <EventDetails
                              event={selectedEvent}
                              departments={departments}
                            />
                            <p className="timeline-actor">
                              Performed by <span>{userName(selectedEvent.user)}</span>
                            </p>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        ) : null}
      </div>
    </aside>
  )
}
