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
import { HandoffDialog } from './HandoffDialog'
import { HandoffRequestCard } from './HandoffRequestCard'
import { LoadingState } from '../ui/LoadingState'

export function HandoffPanel({ ticket, onTicketChanged }) {
  const { user } = useAuthentication()
  const [handoffs, setHandoffs] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const loadHandoffs = useCallback(async ({ append = false, nextPage = 1 } = {}) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError('')
    try {
      const result = await getTicketHandoffs(ticket.ticketId, {
        page: nextPage,
        pageSize: 25,
      })
      const requests = result?.items ?? []
      setHandoffs((current) => (append ? [...current, ...requests] : requests))
      setPage(nextPage)
      setHasMore(Boolean(result?.hasMore))
      setPendingCount(result?.pendingCount ?? 0)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load handoff requests.')
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }, [ticket.ticketId])

  useEffect(() => {
    // Initial data load synchronizes this panel with the handoff API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      {!loading && !error && hasMore ? (
        <button type="button" className="btn ghost" onClick={() => void loadHandoffs({ append: true, nextPage: page + 1 })} disabled={loadingMore}>
          {loadingMore ? 'Loading older requests…' : 'Load older requests'}
        </button>
      ) : null}
      {pendingCount > 0 ? (
        <p className="handoff-footnote">Pending requests: {pendingCount}</p>
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
