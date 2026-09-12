import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TicketList } from '../../components/tickets/TicketList'
import { getTickets } from '../../features/tickets/ticket-api'

export function TicketsPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getTickets()
      setTickets(Array.isArray(result) ? result : [])
    } catch (loadError) {
      setError(loadError.message || 'Unable to load your tickets. Please try again.')
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Tickets</h1>
        </div>
        <Link to="/tickets/new" className="btn primary">
          New ticket
        </Link>
      </header>

      {loading ? <p className="muted">Loading tickets...</p> : null}

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
          <h2>No tickets yet</h2>
          <p>Submit a request and it will show up here.</p>
          <Link to="/tickets/new" className="btn primary">
            Submit a ticket
          </Link>
        </div>
      ) : null}

      {!loading && !error && tickets.length > 0 ? (
        <TicketList tickets={tickets} />
      ) : null}
    </section>
  )
}
