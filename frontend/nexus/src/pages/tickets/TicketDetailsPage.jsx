import { useCallback, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { LoadingState } from '../../components/ui/LoadingState'
import { TicketDetailsHeader } from '../../components/tickets/TicketDetailsHeader'
import { TicketDetailsWorkspace } from '../../components/tickets/TicketDetailsWorkspace'
import { useAuthentication } from '../../features/authentication/use-authentication'
import { useDepartments } from '../../features/departments/use-departments'
import { useNotifications } from '../../features/notifications/use-notifications'
import { usePriorities } from '../../features/priorities/use-priorities'
import { canWorkTickets, UserRole } from '../../features/tickets/ticket-types'
import { useTicketActions } from '../../features/tickets/use-ticket-actions'
import { useTicketAttachments } from '../../features/tickets/use-ticket-attachments'
import { useTicketDetails } from '../../features/tickets/use-ticket-details'
import { useTicketTimeline } from '../../features/tickets/use-ticket-timeline'

export function TicketDetailsPage() {
  const { ticketId } = useParams()
  const location = useLocation()
  const { user } = useAuthentication()
  const { refreshNotificationCounts } = useNotifications()
  const [editing, setEditing] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(true)
  const timeline = useTicketTimeline(ticketId)
  const attachments = useTicketAttachments(ticketId)
  const { reload: reloadTimeline } = timeline
  const { reload: reloadAttachments } = attachments
  const handleRemoteUpdate = useCallback(() => {
    void reloadTimeline({ silent: true })
    void reloadAttachments()
  }, [reloadAttachments, reloadTimeline])
  const details = useTicketDetails(ticketId, handleRemoteUpdate)
  const { reload: reloadDetails, updateTicket } = details
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

  const handleTicketChanged = useCallback((updated, action) => {
    updateTicket(updated)
    if (action === 'update') setEditing(false)
  }, [updateTicket])
  const handleRefreshResources = useCallback(() => {
    void reloadTimeline()
    void reloadAttachments()
  }, [reloadAttachments, reloadTimeline])
  const handleHandoffChanged = useCallback(() => {
    void reloadDetails()
    void reloadTimeline()
  }, [reloadDetails, reloadTimeline])
  const actions = useTicketActions({
    ticketId,
    onTicketChanged: handleTicketChanged,
    onRefreshResources: handleRefreshResources,
    refreshNotificationCounts,
  })
  const permissions = details.ticket?.permissions ?? {}
  const adminClosingAnotherAgentTicket = Boolean(
    user?.role === UserRole.ADMIN &&
      details.ticket?.agent &&
      details.ticket.agent.userId !== user.userId,
  )
  const backPath = location.state?.from ?? '/tickets'
  const backLabel = backPath.startsWith('/admin/logs')
    ? 'Logs'
    : backPath.startsWith('/tickets/pool')
      ? 'Ticket pools'
      : 'All tickets'

  const form = {
    saving: actions.saving,
    formError: actions.formError,
    fieldErrors: actions.fieldErrors,
  }
  const actionModel = {
    ...actions,
    onEdit: () => setEditing(true),
  }

  return (
    <section className="page">
      <TicketDetailsHeader
        backPath={backPath}
        backLabel={backLabel}
        ticket={details.ticket}
        editing={editing}
        permissions={permissions}
        adminClosingAnotherAgentTicket={adminClosingAnotherAgentTicket}
        onEdit={() => setEditing(true)}
        actions={actionModel}
      />

      {details.loading ? <LoadingState>Loading ticket...</LoadingState> : null}
      {!details.loading && details.error ? (
        <div className="banner error">
          <p>{details.error}</p>
          <button type="button" className="btn ghost" onClick={() => void details.reload()}>Try again</button>
        </div>
      ) : null}
      {actions.notice ? <p className="banner success">{actions.notice}</p> : null}
      {actions.formError && !editing ? <p className="banner error">{actions.formError}</p> : null}

      {!details.loading && details.ticket ? (
        <TicketDetailsWorkspace
          ticket={details.ticket}
          editing={editing}
          departments={departments}
          priorities={priorities}
          loadingDepartments={loadingDepartments}
          loadingPriorities={loadingPriorities}
          departmentsError={departmentsError}
          prioritiesError={prioritiesError}
          reloadDepartments={reloadDepartments}
          reloadPriorities={reloadPriorities}
          form={form}
          attachments={attachments.attachments}
          attachmentState={attachments}
          timeline={timeline}
          timelineOpen={timelineOpen}
          onToggleTimeline={() => setTimelineOpen((open) => !open)}
          onSubmit={actions.handleUpdate}
          onCancelEdit={() => {
            setEditing(false)
            actions.setFormError('')
            actions.setFieldErrors({})
          }}
          canWork={canWorkTickets(user)}
          onTicketChanged={handleHandoffChanged}
        />
      ) : null}
    </section>
  )
}
