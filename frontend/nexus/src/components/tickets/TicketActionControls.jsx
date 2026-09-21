import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from './ConfirmDialog'
import { TicketMessageDialog } from './TicketMessageDialog'

export function TicketActionControls({ ticket, editing, permissions, adminClosingAnotherAgentTicket, onEdit, actions }) {
  const [dialog, setDialog] = useState(null)
  const showActions = !editing
  const canEdit = Boolean(ticket.active && permissions.canModify)
  const canCancel = Boolean(ticket.active && permissions.canCancel)
  const canClaim = Boolean(ticket.active && permissions.canClaim)
  const canClose = Boolean(ticket.active && permissions.canClose)
  const canReopen = Boolean(ticket.active && permissions.canReopen)

  async function confirmAction(action) {
    const succeeded = await action()
    if (succeeded) setDialog(null)
  }

  return (
    <>
      <div className="header-actions ticket-details-header-actions">
        <Link to={`/chats/${ticket.ticketId}`} className="btn primary ticket-open-chat">Open chat</Link>
        {showActions && canEdit ? <button type="button" className="btn ghost" onClick={onEdit}>Edit</button> : null}
        {showActions && canCancel ? <button type="button" className="btn danger" onClick={() => setDialog('cancel')}>Cancel ticket</button> : null}
        {showActions && canClaim ? <button type="button" className="btn primary" onClick={() => setDialog('claim')}>Claim ticket</button> : null}
        {showActions && canClose ? <button type="button" className="btn primary" onClick={() => { actions.setCloseError(''); setDialog('close') }}>Close ticket</button> : null}
        {showActions && canReopen ? <button type="button" className="btn ghost" onClick={() => { actions.setReopenError(''); setDialog('reopen') }}>Reopen ticket</button> : null}
      </div>

      {dialog === 'cancel' ? (
        <ConfirmDialog
          title="Cancel ticket?"
          message={`Are you sure you want to cancel ${ticket.ticketCode}? This action cannot be undone.`}
          confirmLabel="Cancel Ticket"
          busyLabel="Cancelling..."
          dismissLabel="Keep Ticket"
          busy={actions.cancelling}
          onConfirm={() => void confirmAction(actions.handleCancel)}
          onDismiss={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'claim' ? (
        <ConfirmDialog
          title="Claim ticket?"
          message={`Claim ${ticket.ticketCode} and assign it to yourself?`}
          confirmLabel="Claim Ticket"
          busyLabel="Claiming..."
          dismissLabel="Not now"
          confirmClassName="btn primary"
          busy={actions.claiming}
          onConfirm={() => void confirmAction(actions.handleClaim)}
          onDismiss={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'close' ? (
        <TicketMessageDialog
          title="Close ticket"
          message={adminClosingAnotherAgentTicket
            ? `This ticket is assigned to ${ticket.agent?.fullName ?? 'another agent'}, not you. As an administrator, you can close it. The completion notes will identify you as the administrator who closed the ticket.`
            : `Add a closing message for ${ticket.ticketCode}.`}
          label="Closing message"
          placeholder={adminClosingAnotherAgentTicket ? 'Add administrator notes if needed.' : 'Summarize the resolution for the submitter.'}
          confirmLabel="Close Ticket"
          busyLabel="Closing..."
          dismissLabel="Keep open"
          busy={actions.closing}
          includeAttachments
          required={!adminClosingAnotherAgentTicket}
          error={actions.closeError}
          onConfirm={(notes, files) => void confirmAction(() => actions.handleClose(notes, files))}
          onDismiss={() => { actions.setCloseError(''); setDialog(null) }}
        />
      ) : null}
      {dialog === 'reopen' ? (
        <TicketMessageDialog
          title="Reopen ticket"
          message={`Describe what still needs attention on ${ticket.ticketCode}.`}
          label="Updated description"
          placeholder="Add context for the next agent."
          confirmLabel="Reopen Ticket"
          busyLabel="Reopening..."
          dismissLabel="Keep closed"
          busy={actions.reopening}
          includeAttachments
          error={actions.reopenError}
          onConfirm={(description, files) => void confirmAction(() => actions.handleReopen(description, files))}
          onDismiss={() => { actions.setReopenError(''); setDialog(null) }}
        />
      ) : null}
    </>
  )
}
