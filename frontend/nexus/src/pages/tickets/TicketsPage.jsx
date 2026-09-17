import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TicketList } from '../../components/tickets/TicketList'
import { LoadingState } from '../../components/ui/LoadingState'
import { useDepartments } from '../../features/departments/use-departments'
import {
  getDepartmentTickets,
  getSubmittedTickets,
  getTicketPool,
} from '../../features/tickets/ticket-api'

const TICKET_VIEWS = {
  submitted: {
    eyebrow: 'Submitted requests',
    title: 'My tickets',
    loading: 'Loading your tickets...',
    error: 'Unable to load your tickets. Please try again.',
    emptyTitle: 'No tickets yet',
    emptyText: 'Submit a request and it will show up here.',
    showEmptyAction: true,
    description: 'Track your requests and stay up to date on every resolution.',
    loader: getSubmittedTickets,
  },
}

const POOL_VIEWS = {
  unclaimed: {
    eyebrow: 'Ticket pools',
    title: 'Unclaimed tickets',
    description: 'Pick up an open request and help keep the queue moving.',
    loading: 'Loading unclaimed tickets...',
    error: 'Unable to load unclaimed tickets. Please try again.',
    emptyTitle: 'The pool is clear',
    emptyText: 'Open department tickets waiting to be claimed will show up here.',
    loader: getTicketPool,
  },
  all: {
    eyebrow: 'Ticket pools',
    title: 'All department tickets',
    description: 'Review every request currently assigned to your departments.',
    loading: 'Loading department tickets...',
    error: 'Unable to load department tickets. Please try again.',
    emptyTitle: 'No department tickets',
    emptyText: 'Tickets for your departments will show up here.',
    loader: getDepartmentTickets,
  },
}

export function TicketsPage({ view = 'submitted' }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const poolMode = searchParams.get('view') === 'all' ? 'all' : 'unclaimed'
  const config = view === 'pool'
    ? POOL_VIEWS[poolMode]
    : TICKET_VIEWS[view] ?? TICKET_VIEWS.submitted
  const requestKey = view === 'pool' ? `pool:${poolMode}` : view
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadedRequestKey, setLoadedRequestKey] = useState(null)
  const [error, setError] = useState('')
  const { departments } = useDepartments()
  const isLoading = loading || loadedRequestKey !== requestKey

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await config.loader()
      setTickets(Array.isArray(result) ? result : [])
    } catch (loadError) {
      setError(loadError.message || config.error)
      setTickets([])
    } finally {
      setLoadedRequestKey(requestKey)
      setLoading(false)
    }
  }, [config, requestKey])

  useEffect(() => {
    let active = true

    async function loadInitialTickets() {
      try {
        const result = await config.loader()
        if (active) {
          setError('')
          setTickets(Array.isArray(result) ? result : [])
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError.message ||
              config.error,
          )
          setTickets([])
        }
      } finally {
        if (active) {
          setLoadedRequestKey(requestKey)
          setLoading(false)
        }
      }
    }

    void loadInitialTickets()

    return () => {
      active = false
    }
  }, [config, requestKey])

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{config.eyebrow}</p>
          <h1>{config.title}</h1>
          <p className="page-description">{config.description}</p>
        </div>
        <Link to="/tickets/new" className="btn primary">
          New ticket
        </Link>
      </header>

      {view === 'pool' ? (
        <div className="pool-switcher" role="tablist" aria-label="Ticket pool view">
          <button
            type="button"
            role="tab"
            aria-selected={poolMode === 'unclaimed'}
            className={poolMode === 'unclaimed' ? 'is-active' : ''}
            onClick={() => setSearchParams({})}
          >
            Unclaimed tickets
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={poolMode === 'all'}
            className={poolMode === 'all' ? 'is-active' : ''}
            onClick={() => setSearchParams({ view: 'all' })}
          >
            All department tickets
          </button>
        </div>
      ) : null}

      {isLoading ? <LoadingState>{config.loading}</LoadingState> : null}

      {!isLoading && error ? (
        <div className="banner error">
          <p>{error}</p>
          <button type="button" className="btn ghost" onClick={loadTickets}>
            Try again
          </button>
        </div>
      ) : null}

      {!isLoading && !error && tickets.length === 0 ? (
        <div className="empty-state clay-card content-reveal">
          <h2>{config.emptyTitle}</h2>
          <p>{config.emptyText}</p>
          {config.showEmptyAction ? (
            <Link to="/tickets/new" className="btn primary">
              Submit a ticket
            </Link>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !error && tickets.length > 0 ? (
        <div className="list-heading content-reveal">
          <span>{tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}</span>
          <span className="list-heading-note">Recently updated</span>
        </div>
      ) : null}

      {!isLoading && !error && tickets.length > 0 ? (
          <TicketList tickets={tickets} departments={departments} />
      ) : null}
    </section>
  )
}
