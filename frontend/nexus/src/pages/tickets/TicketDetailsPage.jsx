import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/tickets/ConfirmDialog'
import { TicketDetails } from '../../components/tickets/TicketDetails'
import {
  TicketForm,
  validateTicketFields,
} from '../../components/tickets/TicketForm'
import { useDepartments } from '../../features/departments/use-departments'
import {
  cancelTicket,
  getTicket,
  updateTicket,
} from '../../features/tickets/ticket-api'
import { isOpenTicket } from '../../features/tickets/ticket-types'

export function TicketDetailsPage() {
  const { ticketId } = useParams()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [notice, setNotice] = useState('')
  const {
    departments,
    loading: loadingDepartments,
    error: departmentsError,
    reload: reloadDepartments,
  } = useDepartments()

  const loadTicket = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getTicket(ticketId)
      setTicket(result)
    } catch (loadError) {
      setTicket(null)
      setError(loadError.message || 'Unable to load this ticket. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    loadTicket()
  }, [loadTicket])

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
      })
      setTicket(updated)
      setEditing(false)
      setNotice('Ticket updated.')
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
      setEditing(false)
      setNotice('This ticket has been cancelled.')
    } catch (cancelError) {
      setFormError(
        cancelError.message ||
          'Unable to cancel this ticket. The ticket may have changed since you opened it.',
      )
    } finally {
      setCancelling(false)
    }
  }

  const canMutate = ticket ? isOpenTicket(ticket) : false

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <Link to="/tickets" className="back-link">
            ← All tickets
          </Link>
          <h1>Ticket details</h1>
        </div>
        {canMutate && !editing ? (
          <div className="header-actions">
            <button type="button" className="btn ghost" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel ticket
            </button>
          </div>
        ) : null}
      </header>

      {loading ? <p className="muted">Loading ticket...</p> : null}

      {!loading && error ? (
        <div className="banner error">
          <p>{error}</p>
          <button type="button" className="btn ghost" onClick={loadTicket}>
            Try again
          </button>
        </div>
      ) : null}

      {notice ? <p className="banner success">{notice}</p> : null}
      {formError && !editing ? <p className="banner error">{formError}</p> : null}

      {!loading && ticket && editing ? (
        loadingDepartments ? (
          <p className="muted">Loading departments...</p>
        ) : departmentsError ? (
          <div className="banner error">
            <p>{departmentsError}</p>
            <button type="button" className="btn ghost" onClick={reloadDepartments}>
              Try again
            </button>
          </div>
        ) : (
          <TicketForm
            key={`${ticket.ticketId}-edit`}
            initialValues={ticket}
            departments={departments}
            submitLabel="Save changes"
            submittingLabel="Saving..."
            submitting={saving}
            error={formError}
            fieldErrors={fieldErrors}
            onSubmit={handleUpdate}
            onCancel={() => {
              setEditing(false)
              setFormError('')
              setFieldErrors({})
            }}
          />
        )
      ) : null}

      {!loading && ticket && !editing ? (
        <TicketDetails ticket={ticket} departments={departments} />
      ) : null}

      {confirmingCancel && ticket ? (
        <ConfirmDialog
          title="Cancel ticket?"
          message={`Are you sure you want to cancel ${ticket.ticketCode}? This action cannot be undone.`}
          confirmLabel="Cancel Ticket"
          busy={cancelling}
          onConfirm={handleCancel}
          onDismiss={() => setConfirmingCancel(false)}
        />
      ) : null}

      {!loading && ticket && !canMutate && ticket.active === false ? (
        <p className="muted">This ticket can no longer be edited or cancelled.</p>
      ) : null}
    </section>
  )
}
