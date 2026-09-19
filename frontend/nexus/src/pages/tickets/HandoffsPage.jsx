import { useCallback, useEffect, useState } from 'react'
import { HandoffRequestCard } from '../../components/tickets/HandoffRequestCard'
import { LoadingState } from '../../components/ui/LoadingState'
import { useAuthentication } from '../../features/authentication/use-authentication'
import {
  acceptHandoff,
  cancelHandoff,
  getIncomingHandoffs,
  getOutgoingHandoffs,
  rejectHandoff,
} from '../../features/tickets/ticket-api'
import { HandoffStatus } from '../../features/tickets/ticket-types'

export function HandoffsPage() {
  const { user } = useAuthentication()
  const [view, setView] = useState('incoming')
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadHandoffs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [incomingResult, outgoingResult] = await Promise.all([
        getIncomingHandoffs(),
        getOutgoingHandoffs(),
      ])
      setIncoming(Array.isArray(incomingResult) ? incomingResult : [])
      setOutgoing(Array.isArray(outgoingResult) ? outgoingResult : [])
    } catch (loadError) {
      setError(loadError.message || 'Unable to load handoff requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHandoffs()
  }, [loadHandoffs])

  async function resolveHandoff(action, handoff) {
    setBusy(true)
    setActionError('')
    try {
      await action(handoff.handoffId)
      await loadHandoffs()
    } catch (actionLoadError) {
      setActionError(actionLoadError.message || 'This handoff request is no longer available.')
      await loadHandoffs()
    } finally {
      setBusy(false)
    }
  }

  const requests = view === 'incoming' ? incoming : outgoing
  const pendingCount = requests.filter((handoff) => handoff.status === HandoffStatus.PENDING).length

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Delegation</p>
          <h1>Ticket handoffs</h1>
          <p className="page-description">Review requests to take over tickets and proposals you have sent.</p>
        </div>
      </header>

      <div className="handoff-page-tabs" role="tablist" aria-label="Handoff requests">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'incoming'}
          className={`tab-button ${view === 'incoming' ? 'is-active' : ''}`}
          onClick={() => setView('incoming')}
        >
          Incoming
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'outgoing'}
          className={`tab-button ${view === 'outgoing' ? 'is-active' : ''}`}
          onClick={() => setView('outgoing')}
        >
          Outgoing
        </button>
      </div>

      {error ? (
        <div className="banner error">
          <p>{error}</p>
          <button type="button" className="btn ghost" onClick={loadHandoffs}>Try again</button>
        </div>
      ) : null}
      {actionError ? <p className="banner error">{actionError}</p> : null}
      {loading ? <LoadingState>Loading handoff requests…</LoadingState> : null}
      {!loading && !error && requests.length === 0 ? (
        <div className="empty-state clay-card">
          <h2>No {view} handoffs</h2>
          <p>{view === 'incoming' ? 'Requests from other agents will appear here.' : 'Handoffs you send will appear here.'}</p>
        </div>
      ) : null}
      {!loading && !error && requests.length > 0 ? (
        <div className="handoff-page-list">
          {requests.map((handoff) => (
            <HandoffRequestCard
              key={handoff.handoffId}
              handoff={handoff}
              currentUserId={user?.userId}
              mode="inbox"
              busy={busy}
              onAccept={(item) => resolveHandoff(acceptHandoff, item)}
              onReject={(item) => resolveHandoff(rejectHandoff, item)}
              onCancel={(item) => resolveHandoff(cancelHandoff, item)}
            />
          ))}
        </div>
      ) : null}
      {!loading && requests.length > 0 ? <p className="handoff-footnote">Pending in this view: {pendingCount}</p> : null}
    </section>
  )
}
