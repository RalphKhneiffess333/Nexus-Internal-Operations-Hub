import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/tickets/ConfirmDialog'
import { TicketDetails } from '../../components/tickets/TicketDetails'
import { TicketMessageDialog } from '../../components/tickets/TicketMessageDialog'
import { LoadingState } from '../../components/ui/LoadingState'
import {
  TicketForm,
} from '../../components/tickets/TicketForm'
import { validateTicketFields } from '../../components/tickets/ticket-validation'
import { useDepartments } from '../../features/departments/use-departments'
import {
  cancelTicket,
  claimTicket,
  closeTicket,
  getTicket,
  reopenTicket,
  updateTicket,
} from '../../features/tickets/ticket-api'

export function TicketDetailsPage() {
  const { ticketId } = useParams()
  const location = useLocation()
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
    let active = true

    async function loadInitialTicket() {
      try {
        const result = await getTicket(ticketId)
        if (active) {
          setTicket(result)
        }
      } catch (loadError) {
        if (active) {
          setTicket(null)
          setError(
            loadError.message ||
              'Unable to load this ticket. Please try again.',
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadInitialTicket()

    return () => {
      active = false
    }
  }, [ticketId])

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

  async function handleClaim() {
    setClaiming(true)
    setFormError('')
    try {
      const claimed = await claimTicket(ticketId)
      setTicket(claimed)
      setConfirmingClaim(false)
      setNotice('Ticket claimed.')
    } catch (claimError) {
      setFormError(
        claimError.message ||
          'Unable to claim this ticket. It may have changed since you opened it.',
      )
    } finally {
      setClaiming(false)
    }
  }

  async function handleClose(completionNotes) {
    setClosing(true)
    setCloseError('')
    try {
      const closed = await closeTicket(ticketId, { completionNotes })
      setTicket(closed)
      setShowingCloseDialog(false)
      setNotice('Ticket closed.')
    } catch (closeTicketError) {
      setCloseError(
        closeTicketError.message ||
          'Unable to close this ticket. It may have changed since you opened it.',
      )
    } finally {
      setClosing(false)
    }
  }

  async function handleReopen(description) {
    setReopening(true)
    setReopenError('')
    try {
      const reopened = await reopenTicket(ticketId, { description })
      setTicket(reopened)
      setShowingReopenDialog(false)
      setNotice('Ticket reopened.')
    } catch (reopenTicketError) {
      setReopenError(
        reopenTicketError.message ||
          'Unable to reopen this ticket. It may have changed since you opened it.',
      )
    } finally {
      setReopening(false)
    }
  }

  const permissions = ticket?.permissions ?? {}
  const canEdit = Boolean(permissions.canModify)
  const canCancel = Boolean(permissions.canCancel)
  const canClaim = Boolean(permissions.canClaim)
  const canClose = Boolean(permissions.canClose)
  const canReopen = Boolean(permissions.canReopen)
  const showHeaderActions =
    ticket && !editing && (canEdit || canCancel || canClaim || canClose || canReopen)

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <Link to={location.state?.from ?? '/tickets'} className="back-link">
            ← {location.state?.from?.startsWith('/tickets/pool') ? 'Ticket pools' : 'All tickets'}
          </Link>
          <h1>Ticket details</h1>
          <p className="page-description">
            Review the request, follow its progress, and take the next action.
          </p>
        </div>
        {showHeaderActions ? (
          <div className="header-actions">
            {canEdit ? (
              <button type="button" className="btn ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                className="btn danger"
                onClick={() => setConfirmingCancel(true)}
              >
                Cancel ticket
              </button>
            ) : null}
            {canClaim ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => setConfirmingClaim(true)}
              >
                Claim ticket
              </button>
            ) : null}
            {canClose ? (
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
            {canReopen ? (
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
          <button type="button" className="btn ghost" onClick={loadTicket}>
            Try again
          </button>
        </div>
      ) : null}

      {notice ? <p className="banner success">{notice}</p> : null}
      {formError && !editing ? <p className="banner error">{formError}</p> : null}

      {!loading && ticket && editing ? (
        loadingDepartments ? (
          <LoadingState>Loading departments...</LoadingState>
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
          message={`Add a closing message for ${ticket.ticketCode}.`}
          label="Closing message"
          placeholder="Summarize the resolution for the submitter."
          confirmLabel="Close Ticket"
          busyLabel="Closing..."
          dismissLabel="Keep open"
          busy={closing}
          required
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
          error={reopenError}
          onConfirm={handleReopen}
          onDismiss={() => {
            setReopenError('')
            setShowingReopenDialog(false)
          }}
        />
      ) : null}

      {!loading && ticket && ticket.active === false ? (
        <p className="muted">This ticket can no longer be edited or cancelled.</p>
      ) : null}
    </section>
  )
}
