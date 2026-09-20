import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HandoffFilters } from '../../components/tickets/HandoffFilters'
import { HandoffRequestCard } from '../../components/tickets/HandoffRequestCard'
import { LoadingState } from '../../components/ui/LoadingState'
import { IllustratedEmptyState } from '../../components/ui/IllustratedEmptyState'
import noHandoffImage from '../../assets/NoHandoff.png'
import { useAuthentication } from '../../features/authentication/use-authentication'
import { useDepartments } from '../../features/departments/use-departments'
import {
  acceptHandoff,
  cancelHandoff,
  getHandoffParticipants,
  getHandoffs,
  rejectHandoff,
} from '../../features/tickets/ticket-api'
import { useLatestRequest } from '../../lib/api/use-latest-request'

export function HandoffsPage() {
  const { user } = useAuthentication()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'outgoing' ? 'outgoing' : 'incoming'
  const search = searchParams.get('search') ?? ''
  const requestedAgentId = searchParams.get('requestedAgentId') ?? ''
  const requesterId = searchParams.get('requesterId') ?? ''
  const departmentId = searchParams.get('departmentId') ?? ''
  const status = searchParams.get('status') ?? ''
  const parsedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [participantOptions, setParticipantOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const { departments } = useDepartments()
  const [hasMore, setHasMore] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const { beginRequest: beginHandoffsRequest } = useLatestRequest()
  const { beginRequest: beginParticipantsRequest } = useLatestRequest()

  const filters = { requestedAgentId, requesterId, departmentId, status }

  const loadHandoffs = useCallback(async () => {
    const request = beginHandoffsRequest()
    setLoading(true)
    setError('')
    try {
      const result = await getHandoffs(
        {
          departmentId,
          status,
          direction: view,
          requestedAgentId: view === 'incoming' ? '' : requestedAgentId,
          requesterId: view === 'outgoing' ? '' : requesterId,
          search,
          page,
          pageSize: 25,
        },
        { signal: request.controller.signal },
      )
      if (!request.isCurrent()) return
      const requests = result?.items ?? []
      if (view === 'incoming') setIncoming(requests)
      else setOutgoing(requests)
      setHasMore(Boolean(result?.hasMore))
      setPendingCount(result?.pendingCount ?? 0)
    } catch (loadError) {
      if (!request.isCurrent()) return
      setError(loadError.message || 'Unable to load handoff requests.')
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [beginHandoffsRequest, departmentId, page, requestedAgentId, requesterId, search, status, view])

  const loadParticipantOptions = useCallback(async () => {
    const request = beginParticipantsRequest()
    try {
      const result = await getHandoffParticipants({ signal: request.controller.signal })
      if (!request.isCurrent()) return
      setParticipantOptions(Array.isArray(result) ? result : [])
    } catch {
      if (!request.isCurrent()) return
      setParticipantOptions([])
    }
  }, [beginParticipantsRequest])

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
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('page')
    if (value) nextParams.set(name, value)
    else nextParams.delete(name)
    setSearchParams(nextParams, name === 'search' ? { replace: true } : undefined)
  }

  function updateView(nextView) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('page')
    if (nextView === 'outgoing') nextParams.set('view', nextView)
    else nextParams.delete('view')
    if (nextView === 'outgoing') nextParams.delete('requesterId')
    else nextParams.delete('requestedAgentId')
    setSearchParams(nextParams)
  }

  function updatePage(nextPage) {
    const nextParams = new URLSearchParams(searchParams)
    if (nextPage > 1) nextParams.set('page', String(nextPage))
    else nextParams.delete('page')
    setSearchParams(nextParams)
  }

  function clearFilters() {
    const nextParams = new URLSearchParams(searchParams)
    const filterNames = ['search', 'requestedAgentId', 'requesterId', 'departmentId', 'status', 'page']
    filterNames.forEach((name) => nextParams.delete(name))
    setSearchParams(nextParams)
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
          onClick={() => updateView('incoming')}
        >
          Incoming
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'outgoing'}
          className={view === 'outgoing' ? 'is-active' : ''}
          onClick={() => updateView('outgoing')}
        >
          Outgoing
        </button>
      </div>

      <HandoffFilters
        departments={departments}
        users={participantOptions}
        view={view}
        filters={filters}
        searchInput={search}
        onSearch={(value) => updateFilter('search', value.trim())}
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
        <IllustratedEmptyState
          image={noHandoffImage}
          title={`No ${view} handoffs`}
          message={view === 'incoming' ? 'Requests from other agents will appear here.' : 'Handoffs you send will appear here.'}
        />
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
      {!loading && !error && pendingCount > 0 ? <p className="handoff-footnote">Pending matching filters: {pendingCount}</p> : null}
      {!loading && !error && (page > 1 || hasMore) ? <div className="admin-pagination" aria-label="Handoff pages"><button type="button" className="btn ghost" disabled={page === 1} onClick={() => updatePage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" className="btn ghost" disabled={!hasMore} onClick={() => updatePage(page + 1)}>Next</button></div> : null}
    </section>
  )
}
