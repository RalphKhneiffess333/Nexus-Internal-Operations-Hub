import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TicketList } from '../../components/tickets/TicketList'
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
    loader: getSubmittedTickets,
  },
  department: {
    eyebrow: 'Department workspace',
    title: 'Department tickets',
    loading: 'Loading department tickets...',
    error: 'Unable to load department tickets. Please try again.',
    emptyTitle: 'No department tickets',
    emptyText: 'Tickets for your department will show up here.',
    showEmptyAction: false,
    loader: getDepartmentTickets,
  },
  pool: {
    eyebrow: 'Open queue',
    title: 'Ticket pool',
    loading: 'Loading the ticket pool...',
    error: 'Unable to load the ticket pool. Please try again.',
    emptyTitle: 'The pool is clear',
    emptyText: 'Open department tickets waiting to be claimed will show up here.',
    showEmptyAction: false,
    loader: getTicketPool,
  },
}

export function TicketsPage({ view = 'submitted' }) {
  const config = TICKET_VIEWS[view] ?? TICKET_VIEWS.submitted
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { departments } = useDepartments()

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
      setLoading(false)
    }
  }, [config])

  useEffect(() => {
    let active = true

    async function loadInitialTickets() {
      try {
        const result = await config.loader()
        if (active) {
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
          setLoading(false)
        }
      }
    }

    void loadInitialTickets()

    return () => {
      active = false
    }
  }, [config])

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{config.eyebrow}</p>
          <h1>{config.title}</h1>
        </div>
        <Link to="/tickets/new" className="btn primary">
          New ticket
        </Link>
      </header>

      {loading ? <p className="muted">{config.loading}</p> : null}

      {!loading && error ? (
        <div className="banner error">
          <p>{error}</p>
          <button type="button" className="btn ghost" onClick={loadTickets}>
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !error && tickets.length === 0 ? (
        <div className="empty-state clay-card">
          <h2>{config.emptyTitle}</h2>
          <p>{config.emptyText}</p>
          {config.showEmptyAction ? (
            <Link to="/tickets/new" className="btn primary">
              Submit a ticket
            </Link>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && tickets.length > 0 ? (
          <TicketList tickets={tickets} departments={departments} />
      ) : null}
    </section>
  )
}
