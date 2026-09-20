import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/tickets/ConfirmDialog'
import { TicketDetails } from '../../components/tickets/TicketDetails'
import { TicketMessageDialog } from '../../components/tickets/TicketMessageDialog'
import { TicketTimeline } from '../../components/tickets/TicketTimeline'
import { LoadingState } from '../../components/ui/LoadingState'
import {
  TicketForm,
} from '../../components/tickets/TicketForm'
import { validateTicketFields } from '../../components/tickets/ticket-validation'
import { useDepartments } from '../../features/departments/use-departments'
import { usePriorities } from '../../features/priorities/use-priorities'
import { useAuthentication } from '../../features/authentication/use-authentication'
import { useNotifications } from '../../features/notifications/use-notifications'
import { useOperationsSocket } from '../../features/realtime/use-operations-socket'
import { canWorkTickets } from '../../features/tickets/ticket-types'
import { HandoffPanel } from '../../components/tickets/HandoffPanel'
import {
  cancelTicket,
  claimTicket,
  closeTicket,
  getTicketAttachments,
  getTicket,
  getTicketEvent,
  getTicketEvents,
  downloadTicketAttachment,
  openTicketAttachment,
  reopenTicket,
  updateTicket,
} from '../../features/tickets/ticket-api'
import { useLatestRequest } from '../../lib/api/use-latest-request'

export function TicketDetailsPage() {
  const { ticketId } = useParams()
  const location = useLocation()
  const { user } = useAuthentication()
  const { refreshNotificationCounts } = useNotifications()
  const { subscribeToTicket } = useOperationsSocket()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmingClaim, setConfirmingClaim] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [closing, setClosing] = useState(false)
  const [showingCloseDialog, setShowingCloseDialog] = useState(false)
  const [closeError, setCloseError] = useState('')
  const [reopening, setReopening] = useState(false)
  const [showingReopenDialog, setShowingReopenDialog] = useState(false)
  const [reopenError, setReopenError] = useState('')
  const [notice, setNotice] = useState('')
  const [events, setEvents] = useState([])
  const [eventPage, setEventPage] = useState(1)
  const [eventsHasMore, setEventsHasMore] = useState(false)
  const [eventsLoadingMore, setEventsLoadingMore] = useState(false)
  const [ticketAttachments, setTicketAttachments] = useState(null)
  const [timelineOpen, setTimelineOpen] = useState(true)
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [timelineError, setTimelineError] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventDetailLoading, setEventDetailLoading] = useState(false)
  const [eventDetailError, setEventDetailError] = useState('')
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState('')
  const eventDetailRequestId = useRef(0)
  const { beginRequest: beginTicketRequest } = useLatestRequest()
  const { beginRequest: beginEventsRequest } = useLatestRequest()
  const { beginRequest: beginAttachmentsRequest } = useLatestRequest()
  const { beginRequest: beginEventDetailRequest } = useLatestRequest()
  const {
    departments,
    loading: loadingDepartments,
    error: departmentsError,
    reload: reloadDepartments,
  } = useDepartments()
  const {
    priorities,
    loading: loadingPriorities,
    error: prioritiesError,
    reload: reloadPriorities,
  } = usePriorities()

  const loadTicket = useCallback(async ({ silent = false } = {}) => {
    const request = beginTicketRequest()
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const result = await getTicket(ticketId, {
        signal: request.controller.signal,
      })
      if (!request.isCurrent()) return
      setTicket(result)
    } catch (loadError) {
      if (!request.isCurrent()) return
      if (!silent) {
        setTicket(null)
        setError(
          loadError.message || 'Unable to load this ticket. Please try again.',
        )
      }
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [beginTicketRequest, ticketId])

  const loadTicketEvents = useCallback(async ({ silent = false, page = 1, append = false } = {}) => {
    const request = beginEventsRequest()
    if (!silent) {
      if (append) setEventsLoadingMore(true)
      else setTimelineLoading(true)
      setTimelineError('')
    }
    try {
      const result = await getTicketEvents(
        ticketId,
        { page, pageSize: 50 },
        { signal: request.controller.signal },
      )
      if (!request.isCurrent()) return
      const summaries = result?.items ?? (Array.isArray(result) ? result : [])
      setEvents((current) => (append ? [...summaries, ...current] : summaries))
      setEventPage(page)
      setEventsHasMore(result?.hasMore ?? summaries.length === 50)

    } catch (loadError) {
      if (!request.isCurrent()) return
      setTimelineError(
        loadError.message ||
          'Unable to load the ticket timeline. Please try again.',
      )
    } finally {
      if (request.isCurrent()) {
        if (append) setEventsLoadingMore(false)
        else setTimelineLoading(false)
      }
    }
  }, [beginEventsRequest, ticketId])

  const loadTicketAttachments = useCallback(async () => {
    const request = beginAttachmentsRequest()
    try {
      const result = await getTicketAttachments(ticketId, {
        signal: request.controller.signal,
      })
      if (!request.isCurrent()) return
      setTicketAttachments(result)
    } catch {
      if (request.isCurrent()) setTicketAttachments(null)
    }
  }, [beginAttachmentsRequest, ticketId])

  useEffect(() => {
    // The ticket loader owns the initial resource synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTicket()
    void loadTicketAttachments()
  }, [loadTicket, loadTicketAttachments])

  useEffect(() => {
    // The timeline loader synchronizes the page with the event API response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTicketEvents()
  }, [loadTicketEvents])

  useEffect(
    () =>
      subscribeToTicket(ticketId, (event) => {
        if (event?.payload?.active === false) {
          setTicket((currentTicket) =>
            currentTicket
              ? {
                  ...currentTicket,
                  active: false,
                  status: event.payload.status ?? currentTicket.status,
                  updatedAt: event.payload.updatedAt ?? currentTicket.updatedAt,
                  permissions: {
                    ...currentTicket.permissions,
                    canModify: false,
                    canCancel: false,
                    canClaim: false,
                    canClose: false,
                    canReopen: false,
                  },
                }
              : currentTicket,
          )
          return
        }
        setTicket((currentTicket) =>
          currentTicket
            ? {
                ...currentTicket,
                status: event?.payload?.status ?? currentTicket.status,
                updatedAt: event?.payload?.updatedAt ?? currentTicket.updatedAt,
              }
            : currentTicket,
        )
        void loadTicket({ silent: true })
        void loadTicketEvents({ silent: true })
        void loadTicketAttachments()
      }),
    [loadTicket, loadTicketAttachments, loadTicketEvents, subscribeToTicket, ticketId],
  )

  async function handleSelectEvent(event) {
    const requestId = eventDetailRequestId.current + 1
    eventDetailRequestId.current = requestId
    const request = beginEventDetailRequest()

    if (selectedEventId === event.ticketEventId) {
      setSelectedEventId('')
      setSelectedEvent(null)
      setEventDetailError('')
      setEventDetailLoading(false)
      return
    }

    setSelectedEventId(event.ticketEventId)
    setSelectedEvent(null)
    setEventDetailError('')
    setEventDetailLoading(true)

    try {
      const result = await getTicketEvent(ticketId, event.ticketEventId, {
        signal: request.controller.signal,
      })
      if (request.isCurrent() && eventDetailRequestId.current === requestId) {
        setSelectedEvent(result)
      }
    } catch (detailError) {
      if (request.isCurrent() && eventDetailRequestId.current === requestId) {
        setEventDetailError(
          detailError.message || 'Unable to load this event. Please try again.',
        )
      }
    } finally {
      if (request.isCurrent() && eventDetailRequestId.current === requestId) {
        setEventDetailLoading(false)
      }
    }
  }

  async function handleUpdate(values) {
    const nextFieldErrors = validateTicketFields(values)
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) {
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const updated = await updateTicket(ticketId, {
        title: values.title,
        description: values.description,
        priority: values.priority,
        departmentId: values.departmentId,
      }, values.files, values.removedAttachmentIds)
      setTicket(updated)
      setEditing(false)
      setNotice('Ticket updated.')
      void loadTicketEvents()
      void loadTicketAttachments()
    } catch (updateError) {
      setFormError(
        updateError.message ||
          'Unable to update this ticket. The ticket may have changed since you opened it.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    setFormError('')
    try {
      const cancelled = await cancelTicket(ticketId)
      setTicket(cancelled)
      setConfirmingCancel(false)
      setNotice('This ticket has been cancelled.')
      void refreshNotificationCounts()
      void loadTicketEvents()
      void loadTicketAttachments()
    } catch (cancelError) {
      setFormError(
        cancelError.message ||
          'Unable to cancel this ticket. The ticket may have changed since you opened it.',
      )
    } finally {
      setCancelling(false)
    }
  }

  async function handleClaim() {
    setClaiming(true)
    setFormError('')
    try {
      const claimed = await claimTicket(ticketId)
      setTicket(claimed)
      setConfirmingClaim(false)
      setNotice('Ticket claimed.')
      void refreshNotificationCounts()
      void loadTicketEvents()
      void loadTicketAttachments()
    } catch (claimError) {
      setFormError(
        claimError.message ||
          'Unable to claim this ticket. It may have changed since you opened it.',
      )
    } finally {
      setClaiming(false)
    }
  }

  async function handleClose(completionNotes, files) {
    setClosing(true)
    setCloseError('')
    try {
      const closed = await closeTicket(ticketId, { completionNotes }, files)
      setTicket(closed)
      setShowingCloseDialog(false)
      setNotice('Ticket closed.')
      void refreshNotificationCounts()
      void loadTicketEvents()
      void loadTicketAttachments()
    } catch (closeTicketError) {
      setCloseError(
        closeTicketError.message ||
          'Unable to close this ticket. It may have changed since you opened it.',
      )
    } finally {
      setClosing(false)
    }
  }

  async function handleReopen(description, files) {
    setReopening(true)
    setReopenError('')
    try {
      const reopened = await reopenTicket(ticketId, { description }, files)
      setTicket(reopened)
      setShowingReopenDialog(false)
      setNotice('Ticket reopened.')
      void refreshNotificationCounts()
      void loadTicketEvents()
      void loadTicketAttachments()
    } catch (reopenTicketError) {
      setReopenError(
        reopenTicketError.message ||
          'Unable to reopen this ticket. It may have changed since you opened it.',
      )
    } finally {
      setReopening(false)
    }
  }

  async function handleDownloadAttachment(attachment, eventId) {
    setDownloadingAttachmentId(attachment.attachmentId)
    setEventDetailError('')
    try {
      await downloadTicketAttachment(ticketId, eventId, attachment.attachmentId)
    } catch (downloadError) {
      setEventDetailError(
        downloadError.message || 'Unable to download this attachment. Please try again.',
      )
    } finally {
      setDownloadingAttachmentId('')
    }
  }

  async function handleOpenAttachment(attachment, eventId) {
    setDownloadingAttachmentId(attachment.attachmentId)
    setEventDetailError('')
    try {
      await openTicketAttachment(ticketId, eventId, attachment.attachmentId)
    } catch (openError) {
      setEventDetailError(
        openError.message || 'Unable to open this attachment. Please try again.',
      )
    } finally {
      setDownloadingAttachmentId('')
    }
  }

  const permissions = ticket?.permissions ?? {}
  const canEdit = Boolean(ticket?.active && permissions.canModify)
  const canCancel = Boolean(ticket?.active && permissions.canCancel)
  const canClaim = Boolean(ticket?.active && permissions.canClaim)
  const canClose = Boolean(ticket?.active && permissions.canClose)
  const canReopen = Boolean(ticket?.active && permissions.canReopen)
  const adminClosingAnotherAgentTicket = Boolean(
    user?.role === 'Admin' &&
      ticket?.agent &&
      ticket.agent.userId !== user.userId,
  )
  const showTicketActions = !editing
  const backPath = location.state?.from ?? '/tickets'
  const backLabel = backPath.startsWith('/admin/logs')
    ? 'Logs'
    : backPath.startsWith('/tickets/pool')
      ? 'Ticket pools'
      : 'All tickets'

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <Link to={backPath} className="back-link">
            ← {backLabel}
          </Link>
          <h1>Ticket details</h1>
          <p className="page-description">
            Review the request, follow its progress, and take the next action.
          </p>
        </div>
        {ticket ? (
          <div className="header-actions ticket-details-header-actions">
            <Link to={`/chats/${ticket.ticketId}`} className="btn primary ticket-open-chat">
              Open chat
            </Link>
            {showTicketActions && canEdit ? (
              <button type="button" className="btn ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
            ) : null}
            {showTicketActions && canCancel ? (
              <button
                type="button"
                className="btn danger"
                onClick={() => setConfirmingCancel(true)}
              >
                Cancel ticket
              </button>
            ) : null}
            {showTicketActions && canClaim ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => setConfirmingClaim(true)}
              >
                Claim ticket
              </button>
            ) : null}
            {showTicketActions && canClose ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setCloseError('')
                  setShowingCloseDialog(true)
                }}
              >
                Close ticket
              </button>
            ) : null}
            {showTicketActions && canReopen ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setReopenError('')
                  setShowingReopenDialog(true)
                }}
              >
                Reopen ticket
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {loading ? <LoadingState>Loading ticket...</LoadingState> : null}

      {!loading && error ? (
        <div className="banner error">
          <p>{error}</p>
          <button type="button" className="btn ghost" onClick={() => void loadTicket()}>
            Try again
          </button>
        </div>
      ) : null}

      {notice ? <p className="banner success">{notice}</p> : null}
      {formError && !editing ? <p className="banner error">{formError}</p> : null}

      {!loading && ticket ? (
        <div className={`ticket-workspace${timelineOpen ? '' : ' timeline-hidden'}`}>
          <div className="ticket-workspace-main">
            {editing ? (
              loadingDepartments || loadingPriorities ? (
                <LoadingState>Loading ticket options...</LoadingState>
              ) : departmentsError || prioritiesError ? (
                <div className="banner error">
                  <p>{departmentsError || prioritiesError}</p>
                  <div className="form-actions">
                    {departmentsError ? <button type="button" className="btn ghost" onClick={reloadDepartments}>Retry departments</button> : null}
                    {prioritiesError ? <button type="button" className="btn ghost" onClick={reloadPriorities}>Retry priorities</button> : null}
                  </div>
                </div>
              ) : (
                <TicketForm
                  key={`${ticket.ticketId}-edit`}
                  initialValues={ticket}
                  departments={departments}
                  priorities={priorities}
                  submitLabel="Save changes"
                  submittingLabel="Saving..."
                  submitting={saving}
                  error={formError}
                  fieldErrors={fieldErrors}
                  includeAttachments
                  existingAttachments={ticketAttachments?.attachments}
                  onSubmit={handleUpdate}
                  onCancel={() => {
                    setEditing(false)
                    setFormError('')
                    setFieldErrors({})
                  }}
                />
              )
            ) : (
              <TicketDetails
                ticket={ticket}
                departments={departments}
                priorities={priorities}
                timelineOpen={timelineOpen}
                attachments={ticketAttachments?.attachments}
                downloadingAttachmentId={downloadingAttachmentId}
                onOpenAttachment={(attachment) =>
                  handleOpenAttachment(
                    attachment,
                    ticketAttachments?.ticketEventId,
                  )
                }
                onDownloadAttachment={(attachment) =>
                  handleDownloadAttachment(
                    attachment,
                    ticketAttachments?.ticketEventId,
                  )
                }
                onToggleTimeline={() => setTimelineOpen((open) => !open)}
              />
            )}

            {canWorkTickets(user) ? (
              <HandoffPanel
                ticket={ticket}
                onTicketChanged={() => {
                  void loadTicket()
                  void loadTicketEvents()
                }}
              />
            ) : null}

            {ticket.active === false ? (
              <p className="muted ticket-inactive-note">
                This ticket can no longer be edited or cancelled.
              </p>
            ) : null}
          </div>

          {timelineOpen ? (
            <TicketTimeline
              events={events}
              loading={timelineLoading}
              error={timelineError}
              selectedEvent={selectedEvent}
              selectedEventId={selectedEventId}
              detailLoading={eventDetailLoading}
              detailError={eventDetailError}
              downloadingAttachmentId={downloadingAttachmentId}
              departments={departments}
              onSelect={handleSelectEvent}
              onRetry={loadTicketEvents}
              hasMore={eventsHasMore}
              loadingMore={eventsLoadingMore}
              onLoadMore={() => void loadTicketEvents({ page: eventPage + 1, append: true })}
              onOpenAttachment={handleOpenAttachment}
              onDownloadAttachment={handleDownloadAttachment}
            />
          ) : null}
        </div>
      ) : null}

      {confirmingCancel && ticket ? (
        <ConfirmDialog
          title="Cancel ticket?"
          message={`Are you sure you want to cancel ${ticket.ticketCode}? This action cannot be undone.`}
          confirmLabel="Cancel Ticket"
          busyLabel="Cancelling..."
          dismissLabel="Keep Ticket"
          busy={cancelling}
          onConfirm={handleCancel}
          onDismiss={() => setConfirmingCancel(false)}
        />
      ) : null}

      {confirmingClaim && ticket ? (
        <ConfirmDialog
          title="Claim ticket?"
          message={`Claim ${ticket.ticketCode} and assign it to yourself?`}
          confirmLabel="Claim Ticket"
          busyLabel="Claiming..."
          dismissLabel="Not now"
          confirmClassName="btn primary"
          busy={claiming}
          onConfirm={handleClaim}
          onDismiss={() => setConfirmingClaim(false)}
        />
      ) : null}

      {showingCloseDialog && ticket ? (
        <TicketMessageDialog
          title="Close ticket"
          message={
            adminClosingAnotherAgentTicket
              ? `This ticket is assigned to ${ticket.agent?.fullName ?? 'another agent'}, not you. As an administrator, you can close it. The completion notes will identify you as the administrator who closed the ticket.`
              : `Add a closing message for ${ticket.ticketCode}.`
          }
          label="Closing message"
          placeholder={
            adminClosingAnotherAgentTicket
              ? 'Add administrator notes if needed.'
              : 'Summarize the resolution for the submitter.'
          }
          confirmLabel="Close Ticket"
          busyLabel="Closing..."
          dismissLabel="Keep open"
          busy={closing}
          includeAttachments
          required={!adminClosingAnotherAgentTicket}
          error={closeError}
          onConfirm={handleClose}
          onDismiss={() => {
            setCloseError('')
            setShowingCloseDialog(false)
          }}
        />
      ) : null}

      {showingReopenDialog && ticket ? (
        <TicketMessageDialog
          title="Reopen ticket"
          message={`Describe what still needs attention on ${ticket.ticketCode}.`}
          label="Updated description"
          placeholder="Add context for the next agent."
          confirmLabel="Reopen Ticket"
          busyLabel="Reopening..."
          dismissLabel="Keep closed"
          busy={reopening}
          includeAttachments
          error={reopenError}
          onConfirm={handleReopen}
          onDismiss={() => {
            setReopenError('')
            setShowingReopenDialog(false)
          }}
        />
      ) : null}

    </section>
  )
}
