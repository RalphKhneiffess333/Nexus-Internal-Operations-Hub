import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TicketChatPanel } from '../../components/tickets/TicketChatPanel'
import { TicketStatusBadge } from '../../components/tickets/TicketStatusBadge'
import { LoadingState } from '../../components/ui/LoadingState'
import { useAuthentication } from '../../features/authentication/use-authentication'
import { getTicket, markChatConversationRead } from '../../features/tickets/ticket-api'

export function TicketChatPage() {
  const { ticketId } = useParams()
  const { user } = useAuthentication()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTicket = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setTicket(await getTicket(ticketId))
    } catch (loadError) {
      setTicket(null)
      setError(loadError.message || 'Unable to load this ticket conversation.')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  const markRead = useCallback(async () => {
    try {
      await markChatConversationRead(ticketId)
    } catch {
      // A failed read receipt must never block access to the conversation.
    }
  }, [ticketId])

  useEffect(() => {
    // The selected ticket is synchronized from the server when this route is mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTicket()
  }, [loadTicket])

  return (
    <section className="page ticket-chat-page">
      <header className="ticket-chat-page-header">
        <div className="ticket-chat-page-context">
          <Link to="/chats" className="back-link">← Chats</Link>
          {ticket ? (
            <>
              <p className="ticket-code">{ticket.ticketCode}</p>
              <h1>{ticket.title}</h1>
              <TicketStatusBadge status={ticket.status} />
            </>
          ) : (
            <h1>Ticket conversation</h1>
          )}
        </div>
        {ticket ? <Link className="btn ghost" to={`/tickets/${ticket.ticketId}`}>View ticket</Link> : null}
      </header>

      {loading ? <LoadingState>Loading conversation…</LoadingState> : null}
      {!loading && error ? (
        <div className="banner error">
          <p>{error}</p>
          <button type="button" className="btn ghost" onClick={() => void loadTicket()}>
            Try again
          </button>
        </div>
      ) : null}
      {!loading && ticket ? (
        <TicketChatPanel
          ticket={ticket}
          currentUser={user}
          onConversationRead={markRead}
          variant="full"
        />
      ) : null}
    </section>
  )
}
