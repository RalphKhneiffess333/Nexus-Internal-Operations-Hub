import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState } from '../../components/ui/LoadingState'
import { TicketStatusBadge } from '../../components/tickets/TicketStatusBadge'
import { useNotifications } from '../../features/notifications/use-notifications'
import { getChatConversations } from '../../features/tickets/ticket-api'
import { formatDateTime } from '../../features/tickets/ticket-types'

function messagePreview(conversation) {
  const message = conversation.lastMessage
  if (!message) return 'No messages yet'
  if (message.content) return message.content
  return message.hasAttachments ? 'Sent an attachment' : 'New message'
}

export function ChatsPage() {
  const { markAllChatsRead } = useNotifications()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadConversations = useCallback(async ({ silent = false } = {}) => {
    markAllChatsRead()
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const result = await getChatConversations()
      setConversations(Array.isArray(result) ? result : [])
    } catch (loadError) {
      if (!silent) {
        setError(loadError.message || 'Unable to load your conversations.')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [markAllChatsRead])

  useEffect(() => {
    // The inbox is synchronized from the server when this route is mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    const refreshWhenFocused = () => void loadConversations({ silent: true })
    window.addEventListener('focus', refreshWhenFocused)
    return () => window.removeEventListener('focus', refreshWhenFocused)
  }, [loadConversations])

  return (
    <section className="page chats-page">
      <header className="page-header chats-page-header">
        <div>
          <p className="eyebrow">Messages</p>
          <h1>Chats</h1>
          <p className="page-description">
            Conversations are organized by ticket so every update stays in context.
          </p>
        </div>
        <span className="chats-count" aria-label={`${conversations.length} ticket conversations`}>
          {conversations.length}
        </span>
      </header>

      {loading ? <LoadingState>Loading conversations…</LoadingState> : null}
      {!loading && error ? (
        <div className="banner error">
          <p>{error}</p>
          <button type="button" className="btn ghost" onClick={() => void loadConversations()}>
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !error && conversations.length === 0 ? (
        <div className="empty-state clay-card">
          <h2>No ticket chats yet</h2>
          <p>When a ticket conversation starts, it will appear here.</p>
        </div>
      ) : null}

      {!loading && !error && conversations.length > 0 ? (
        <ol className="chat-inbox-list">
          {conversations.map((conversation) => (
            <li key={conversation.ticketId}>
              <Link className="chat-inbox-item clay-card" to={`/chats/${conversation.ticketId}`}>
                <div className="chat-inbox-main">
                  <div className="chat-inbox-title-row">
                    <span className="ticket-code">{conversation.ticketCode}</span>
                    <TicketStatusBadge status={conversation.status} />
                  </div>
                  <h2>{conversation.title}</h2>
                  <p className="chat-inbox-preview">
                    {conversation.lastMessage ? <strong>{conversation.lastMessage.sender.fullName}: </strong> : null}
                    {messagePreview(conversation)}
                  </p>
                </div>
                <div className="chat-inbox-meta">
                  {conversation.lastMessage ? (
                    <time dateTime={conversation.lastMessage.createdAt}>
                      {formatDateTime(conversation.lastMessage.createdAt)}
                    </time>
                  ) : null}
                  {conversation.unread ? <span className="chat-unread-dot" aria-label="Unread messages" /> : null}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}
