import { useCallback, useEffect, useState } from 'react'
import { useAuthentication } from '../../features/authentication/use-authentication'
import {
  acceptHandoff,
  cancelHandoff,
  createHandoff,
  getEligibleHandoffAgents,
  getTicketHandoffs,
  rejectHandoff,
} from '../../features/tickets/ticket-api'
import { HandoffStatus } from '../../features/tickets/ticket-types'
import { HandoffDialog } from './HandoffDialog'
import { HandoffRequestCard } from './HandoffRequestCard'
import { LoadingState } from '../ui/LoadingState'

export function HandoffPanel({ ticket, onTicketChanged }) {
  const { user } = useAuthentication()
  const [handoffs, setHandoffs] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadHandoffs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getTicketHandoffs(ticket.ticketId)
      setHandoffs(Array.isArray(result) ? result : [])
    } catch (loadError) {
      setError(loadError.message || 'Unable to load handoff requests.')
    } finally {
      setLoading(false)
    }
  }, [ticket.ticketId])

  useEffect(() => {
    void loadHandoffs()
  }, [loadHandoffs])

  async function openDialog() {
    setDialogOpen(true)
    setActionError('')
    setLoadingAgents(true)
    try {
      const result = await getEligibleHandoffAgents(ticket.ticketId)
      setAgents(Array.isArray(result) ? result : [])
    } catch (loadError) {
      setActionError(loadError.message || 'Unable to load eligible agents.')
      setAgents([])
    } finally {
      setLoadingAgents(false)
    }
  }

  async function submitHandoff(values) {
    setBusy(true)
    setActionError('')
    try {
      await createHandoff(ticket.ticketId, values)
      setDialogOpen(false)
      await loadHandoffs()
    } catch (handoffError) {
      setActionError(handoffError.message || 'Unable to send this handoff request.')
    } finally {
      setBusy(false)
    }
  }

  async function resolveHandoff(action, handoff) {
    setBusy(true)
    setActionError('')
    try {
      const updated = await action(handoff.handoffId)
      await loadHandoffs()
      if (updated?.ticket?.currentAgent) onTicketChanged?.(updated.ticket.currentAgent)
    } catch (handoffError) {
      setActionError(handoffError.message || 'This handoff request is no longer available.')
      await loadHandoffs()
    } finally {
      setBusy(false)
    }
  }

  const pending = handoffs.filter((handoff) => handoff.status === HandoffStatus.PENDING)
  const canRequest = Boolean(ticket.permissions?.canRequestHandoff)

  return (
    <section className="handoff-panel clay-card" aria-labelledby="handoff-heading">
      <div className="handoff-panel-heading">
        <div>
          <p className="eyebrow">Delegation</p>
          <h2 id="handoff-heading">Ticket handoffs</h2>
          <p className="muted">Ownership changes only after the receiving agent accepts.</p>
        </div>
        {canRequest ? (
          <button type="button" className="btn primary" onClick={openDialog} disabled={busy || loadingAgents}>
            {loadingAgents ? 'Loading agents…' : 'Request handoff'}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="handoff-state handoff-state-error">
          <p>{error}</p>
          <button type="button" className="btn ghost" onClick={loadHandoffs}>Try again</button>
        </div>
      ) : null}
      {actionError ? <p className="banner error">{actionError}</p> : null}
      {loading ? <LoadingState>Loading handoff requests…</LoadingState> : null}
      {!loading && !error && handoffs.length === 0 ? (
        <p className="handoff-empty">No handoff requests have been made for this ticket.</p>
      ) : null}
      {!loading && !error && handoffs.length > 0 ? (
        <div className="handoff-list">
          {handoffs.map((handoff) => (
            <HandoffRequestCard
              key={handoff.handoffId}
              handoff={handoff}
              currentUserId={user?.userId}
              busy={busy}
              onAccept={(item) => resolveHandoff(acceptHandoff, item)}
              onReject={(item) => resolveHandoff(rejectHandoff, item)}
              onCancel={(item) => resolveHandoff(cancelHandoff, item)}
            />
          ))}
        </div>
      ) : null}
      {pending.length > 0 ? (
        <p className="handoff-footnote">Pending requests: {pending.length}</p>
      ) : null}

      {dialogOpen ? (
        <HandoffDialog
          agents={agents}
          busy={busy}
          error={actionError}
          onConfirm={submitHandoff}
          onDismiss={() => {
            if (!busy) setDialogOpen(false)
          }}
        />
      ) : null}
    </section>
  )
}
