import { useState } from 'react'
import { validateTicketFields } from '../../components/tickets/ticket-validation'
import {
  cancelTicket,
  claimTicket,
  closeTicket,
  reopenTicket,
  updateTicket,
} from './ticket-api'

export function useTicketActions({ ticketId, onTicketChanged, onRefreshResources, refreshNotificationCounts }) {
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [cancelling, setCancelling] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')
  const [reopening, setReopening] = useState(false)
  const [reopenError, setReopenError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleUpdate(values) {
    const nextFieldErrors = validateTicketFields(values)
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return false

    setSaving(true)
    setFormError('')
    try {
      const updated = await updateTicket(ticketId, {
        title: values.title,
        description: values.description,
        priority: values.priority,
        departmentId: values.departmentId,
      }, values.files, values.removedAttachmentIds)
      onTicketChanged(updated, 'update')
      setNotice('Ticket updated.')
      onRefreshResources()
      return true
    } catch (updateError) {
      setFormError(updateError.message || 'Unable to update this ticket. The ticket may have changed since you opened it.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    setFormError('')
    try {
      const cancelled = await cancelTicket(ticketId)
      onTicketChanged(cancelled, 'cancel')
      setNotice('This ticket has been cancelled.')
      refreshNotificationCounts()
      onRefreshResources()
      return true
    } catch (cancelError) {
      setFormError(cancelError.message || 'Unable to cancel this ticket. The ticket may have changed since you opened it.')
      return false
    } finally {
      setCancelling(false)
    }
  }

  async function handleClaim() {
    setClaiming(true)
    setFormError('')
    try {
      const claimed = await claimTicket(ticketId)
      onTicketChanged(claimed, 'claim')
      setNotice('Ticket claimed.')
      refreshNotificationCounts()
      onRefreshResources()
      return true
    } catch (claimError) {
      setFormError(claimError.message || 'Unable to claim this ticket. It may have changed since you opened it.')
      return false
    } finally {
      setClaiming(false)
    }
  }

  async function handleClose(completionNotes, files) {
    setClosing(true)
    setCloseError('')
    try {
      const closed = await closeTicket(ticketId, { completionNotes }, files)
      onTicketChanged(closed, 'close')
      setNotice('Ticket closed.')
      refreshNotificationCounts()
      onRefreshResources()
      return true
    } catch (closeTicketError) {
      setCloseError(closeTicketError.message || 'Unable to close this ticket. It may have changed since you opened it.')
      return false
    } finally {
      setClosing(false)
    }
  }

  async function handleReopen(description, files) {
    setReopening(true)
    setReopenError('')
    try {
      const reopened = await reopenTicket(ticketId, { description }, files)
      onTicketChanged(reopened, 'reopen')
      setNotice('Ticket reopened.')
      refreshNotificationCounts()
      onRefreshResources()
      return true
    } catch (reopenTicketError) {
      setReopenError(reopenTicketError.message || 'Unable to reopen this ticket. It may have changed since you opened it.')
      return false
    } finally {
      setReopening(false)
    }
  }

  return {
    saving,
    formError,
    fieldErrors,
    cancelling,
    claiming,
    closing,
    closeError,
    reopening,
    reopenError,
    notice,
    handleUpdate,
    handleCancel,
    handleClaim,
    handleClose,
    handleReopen,
    setFormError,
    setFieldErrors,
    setCloseError,
    setReopenError,
  }
}
