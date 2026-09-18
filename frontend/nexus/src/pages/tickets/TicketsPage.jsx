import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TicketList } from '../../components/tickets/TicketList'
import { LoadingState } from '../../components/ui/LoadingState'
import { useAuthentication } from '../../features/authentication/use-authentication'
import { useDepartments } from '../../features/departments/use-departments'
import {
  getClaimedTickets,
  getDepartmentTickets,
  getResolvedTickets,
  getSubmittedTickets,
  getTickets,
  getTicketPool,
} from '../../features/tickets/ticket-api'
import { canWorkTickets } from '../../features/tickets/ticket-types'

const TICKET_VIEWS = {
  admin: {
    eyebrow: 'System tickets',
    title: 'All tickets',
    loading: 'Loading system tickets...',
    error: 'Unable to load system tickets. Please try again.',
    emptyTitle: 'No tickets found',
    emptyText: 'There are no tickets to display.',
    showEmptyAction: false,
    description: 'Browse active tickets across every department and submitter.',
    loader: getTickets,
  },
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
  claimed: {
    eyebrow: 'Assigned requests',
    title: 'My tickets',
    loading: 'Loading your claimed tickets...',
    error: 'Unable to load your claimed tickets. Please try again.',
    emptyTitle: 'No claimed tickets',
    emptyText: 'Tickets you claim from a department pool will show up here.',
    showEmptyAction: false,
    description: 'Work through the requests currently assigned to you.',
    loader: getClaimedTickets,
  },
  resolved: {
    eyebrow: 'Resolved requests',
    title: 'My tickets',
    loading: 'Loading your resolved tickets...',
    error: 'Unable to load your resolved tickets. Please try again.',
    emptyTitle: 'No resolved tickets',
    emptyText: 'Tickets you resolve will show up here.',
    showEmptyAction: false,
    description: 'Review requests you have completed for your departments.',
    loader: getResolvedTickets,
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
  const { user } = useAuthentication()
  const requestedPoolMode = searchParams.get('view')
  const isAdmin = user?.role === 'Admin'
  const poolMode = requestedPoolMode === 'system' && isAdmin
    ? 'system'
    : requestedPoolMode === 'all'
      ? 'all'
      : 'unclaimed'
  const requestedMyTicketMode = searchParams.get('view')
  const myTicketMode =
    canWorkTickets(user) &&
    (requestedMyTicketMode === 'claimed' || requestedMyTicketMode === 'resolved')
      ? requestedMyTicketMode
      : 'submitted'
  const config = view === 'pool'
    ? poolMode === 'system'
      ? TICKET_VIEWS.admin
      : POOL_VIEWS[poolMode]
    : view === 'admin'
      ? TICKET_VIEWS.admin
    : TICKET_VIEWS[myTicketMode]
  const requestKey = view === 'pool' ? `pool:${poolMode}` : view === 'admin' ? 'admin' : myTicketMode
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
          {isAdmin ? (
            <button
              type="button"
              role="tab"
              aria-selected={poolMode === 'system'}
              className={poolMode === 'system' ? 'is-active' : ''}
              onClick={() => setSearchParams({ view: 'system' })}
            >
              All tickets
            </button>
          ) : null}
        </div>
      ) : view !== 'admin' && canWorkTickets(user) ? (
        <div className="pool-switcher" role="tablist" aria-label="My ticket view">
          <button
            type="button"
            role="tab"
            aria-selected={myTicketMode === 'submitted'}
            className={myTicketMode === 'submitted' ? 'is-active' : ''}
            onClick={() => setSearchParams({})}
          >
            Submitted tickets
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={myTicketMode === 'claimed'}
            className={myTicketMode === 'claimed' ? 'is-active' : ''}
            onClick={() => setSearchParams({ view: 'claimed' })}
          >
            Claimed tickets
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={myTicketMode === 'resolved'}
            className={myTicketMode === 'resolved' ? 'is-active' : ''}
            onClick={() => setSearchParams({ view: 'resolved' })}
          >
            Resolved tickets
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
