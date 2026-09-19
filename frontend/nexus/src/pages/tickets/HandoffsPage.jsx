import { useCallback, useEffect, useState } from 'react'
import { HandoffFilters } from '../../components/tickets/HandoffFilters'
import { HandoffRequestCard } from '../../components/tickets/HandoffRequestCard'
import { LoadingState } from '../../components/ui/LoadingState'
import { useAuthentication } from '../../features/authentication/use-authentication'
import { useDepartments } from '../../features/departments/use-departments'
import {
  acceptHandoff,
  cancelHandoff,
  getHandoffs,
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
  const [participantOptions, setParticipantOptions] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    requestedAgentId: '',
    requesterId: '',
    departmentId: '',
    status: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const { departments } = useDepartments()

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const loadHandoffs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [incomingResult, outgoingResult] = await Promise.all([
        getIncomingHandoffs({
          ...filters,
          requestedAgentId: '',
          search,
        }),
        getOutgoingHandoffs({
          ...filters,
          requesterId: '',
          search,
        }),
      ])
      setIncoming(Array.isArray(incomingResult) ? incomingResult : [])
      setOutgoing(Array.isArray(outgoingResult) ? outgoingResult : [])
    } catch (loadError) {
      setError(loadError.message || 'Unable to load handoff requests.')
    } finally {
      setLoading(false)
    }
  }, [filters, search])

  const loadParticipantOptions = useCallback(async () => {
    try {
      const result = await getHandoffs()
      const handoffs = Array.isArray(result) ? result : []
      const users = new Map()
      handoffs.forEach((handoff) => {
        if (handoff.requester) users.set(handoff.requester.userId, handoff.requester)
        if (handoff.requestedAgent) users.set(handoff.requestedAgent.userId, handoff.requestedAgent)
      })
      setParticipantOptions(
        [...users.values()].sort((left, right) => left.fullName.localeCompare(right.fullName)),
      )
    } catch {
      setParticipantOptions([])
    }
  }, [])

  useEffect(() => {
    // Initial data load synchronizes this page with the handoff API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHandoffs()
  }, [loadHandoffs])

  useEffect(() => {
    // Participant options are loaded independently from the active filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadParticipantOptions()
  }, [loadParticipantOptions])

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function clearFilters() {
    setSearchInput('')
    setSearch('')
    setFilters({
      requestedAgentId: '',
      requesterId: '',
      departmentId: '',
      status: '',
    })
  }

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

      <div className="pool-switcher" role="tablist" aria-label="Handoff requests">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'incoming'}
          className={view === 'incoming' ? 'is-active' : ''}
          onClick={() => setView('incoming')}
        >
          Incoming
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'outgoing'}
          className={view === 'outgoing' ? 'is-active' : ''}
          onClick={() => setView('outgoing')}
        >
          Outgoing
        </button>
      </div>

      <HandoffFilters
        departments={departments}
        users={participantOptions}
        view={view}
        filters={filters}
        searchInput={searchInput}
        onSearch={setSearchInput}
        onChange={updateFilter}
        onClear={clearFilters}
      />

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
