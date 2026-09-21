import { LoadingState } from '../../ui/LoadingState/LoadingState'
import { TicketDetails } from '../TicketDetails/TicketDetails'
import { TicketForm } from '../TicketForm/TicketForm'
import { TicketTimeline } from '../TicketTimeline/TicketTimeline'
import { HandoffPanel } from '../HandoffPanel/HandoffPanel'

export function TicketDetailsWorkspace({
  ticket,
  editing,
  departments,
  priorities,
  loadingDepartments,
  loadingPriorities,
  departmentsError,
  prioritiesError,
  reloadDepartments,
  reloadPriorities,
  form,
  attachments,
  attachmentState,
  timeline,
  timelineOpen,
  onToggleTimeline,
  onSubmit,
  onCancelEdit,
  canWork,
  onTicketChanged,
}) {
  return (
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
              submitting={form.saving}
              error={form.formError}
              fieldErrors={form.fieldErrors}
              includeAttachments
              existingAttachments={attachments?.attachments}
              onSubmit={onSubmit}
              onCancel={onCancelEdit}
            />
          )
        ) : (
          <TicketDetails
            ticket={ticket}
            departments={departments}
            priorities={priorities}
            timelineOpen={timelineOpen}
            attachments={attachments?.attachments}
            downloadingAttachmentId={attachmentState.downloadingAttachmentId}
            onOpenAttachment={attachmentState.openAttachment}
            onDownloadAttachment={attachmentState.downloadAttachment}
            onToggleTimeline={onToggleTimeline}
          />
        )}

        {canWork ? <HandoffPanel ticket={ticket} onTicketChanged={onTicketChanged} /> : null}
        {ticket.active === false ? <p className="muted ticket-inactive-note">This ticket can no longer be edited or cancelled.</p> : null}
      </div>

      {timelineOpen ? (
        <TicketTimeline
          events={timeline.events}
          loading={timeline.timelineLoading}
          error={timeline.timelineError}
          selectedEvent={timeline.selectedEvent}
          selectedEventId={timeline.selectedEventId}
          detailLoading={timeline.eventDetailLoading}
          detailError={timeline.eventDetailError || attachmentState.error}
          downloadingAttachmentId={attachmentState.downloadingAttachmentId}
          departments={departments}
          onSelect={timeline.selectEvent}
          onRetry={timeline.reload}
          hasMore={timeline.eventsHasMore}
          loadingMore={timeline.eventsLoadingMore}
          onLoadMore={() => void timeline.reload({ page: timeline.eventPage + 1, append: true })}
          onOpenAttachment={attachmentState.openAttachment}
          onDownloadAttachment={attachmentState.downloadAttachment}
        />
      ) : null}
    </div>
  )
}

