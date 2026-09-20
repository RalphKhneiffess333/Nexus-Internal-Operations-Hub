import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TicketChatPanel } from '../../../components/tickets/TicketChatPanel/TicketChatPanel'
import { TicketStatusBadge } from '../../../components/tickets/TicketStatusBadge/TicketStatusBadge'
import { LoadingState } from '../../../components/ui/LoadingState/LoadingState'
import { useAuthentication } from '../../../features/authentication/use-authentication'
import { useNotifications } from '../../../features/notifications/use-notifications'
import { getTicketChatContext, markChatConversationRead } from '../../../features/tickets/ticket-api'
import { useLatestRequest } from '../../../lib/api/use-latest-request'
import chatStyles from '../ChatStyles.module.css'

export function TicketChatPage() {
  const { ticketId } = useParams()
  const { user } = useAuthentication()
  const { markChatRead } = useNotifications()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { beginRequest } = useLatestRequest()

  const loadTicket = useCallback(async () => {
    const request = beginRequest()
    setLoading(true)
    setError('')
    try {
      const result = await getTicketChatContext(ticketId, {
        signal: request.controller.signal,
      })
      if (!request.isCurrent()) return
      setTicket(result)
    } catch (loadError) {
      if (!request.isCurrent()) return
      setTicket(null)
      setError(loadError.message || 'Unable to load this ticket conversation.')
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [beginRequest, ticketId])

  const markRead = useCallback(async () => {
    try {
      await markChatConversationRead(ticketId)
      markChatRead(ticketId)
    } catch {
      // A failed read receipt must never block access to the conversation.
    }
  }, [markChatRead, ticketId])

  useEffect(() => {
    // The selected ticket is synchronized from the server when this route is mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTicket()
  }, [loadTicket])

  return (
    <section className={`page ticket-chat-page ${chatStyles.moduleAnchor}`}>
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


