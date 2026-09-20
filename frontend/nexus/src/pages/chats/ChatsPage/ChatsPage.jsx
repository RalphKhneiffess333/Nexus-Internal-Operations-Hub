import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../../components/ui/LoadingState/LoadingState'
import { IllustratedEmptyState } from '../../../components/ui/IllustratedEmptyState'
import noChatsImage from '../../../assets/NoChats.png'
import { DebouncedSearchInput } from '../../../components/ui/DebouncedSearchInput/DebouncedSearchInput'
import { TicketStatusBadge } from '../../../components/tickets/TicketStatusBadge/TicketStatusBadge'
import { getChatConversations } from '../../../features/tickets/ticket-api'
import { formatDateTime } from '../../../features/tickets/ticket-types'
import { useLatestRequest } from '../../../lib/api/use-latest-request'
import chatStyles from '../ChatStyles.module.css'

function messagePreview(conversation) {
  const message = conversation.lastMessage
  if (!message) return 'No messages yet'
  if (message.content) return message.content
  return message.hasAttachments ? 'Sent an attachment' : 'New message'
}

export function ChatsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') ?? ''
  const parsedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const [conversations, setConversations] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { beginRequest } = useLatestRequest()

  const loadConversations = useCallback(async ({ silent = false } = {}) => {
    const request = beginRequest()
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const result = await getChatConversations(
        { page, pageSize: 50, search },
        { signal: request.controller.signal },
      )
      if (!request.isCurrent()) return
      setConversations(result?.items ?? [])
      setHasMore(Boolean(result?.hasMore))
    } catch (loadError) {
      if (!request.isCurrent()) return
      if (!silent) {
        setError(loadError.message || 'Unable to load your conversations.')
        setHasMore(false)
      }
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [beginRequest, page, search])

  useEffect(() => {
    // The inbox is synchronized from the server when this route is mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations()
  }, [loadConversations])

  function updateSearch(value) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('page')
    if (value.trim()) nextParams.set('search', value.trim())
    else nextParams.delete('search')
    setSearchParams(nextParams, { replace: true })
  }

  function updatePage(nextPage) {
    const nextParams = new URLSearchParams(searchParams)
    if (nextPage > 1) nextParams.set('page', String(nextPage))
    else nextParams.delete('page')
    setSearchParams(nextParams)
  }

  useEffect(() => {
    const refreshWhenFocused = () => void loadConversations({ silent: true })
    window.addEventListener('focus', refreshWhenFocused)
    return () => window.removeEventListener('focus', refreshWhenFocused)
  }, [loadConversations])

  return (
    <section className={`page chats-page ${chatStyles.moduleAnchor}`}>
      <header className="page-header chats-page-header">
        <div>
          <p className="eyebrow">Messages</p>
          <h1>Chats</h1>
          <p className="page-description">
            Conversations are organized by ticket so every update stays in context.
          </p>
        </div>
        <span className="chats-count" aria-label={`${conversations.length} ticket conversations on this page`}>
          {conversations.length}
        </span>
      </header>

      <div className="ticket-filters chat-inbox-filters" aria-label="Chat filters">
        <label className="field ticket-filter ticket-search-filter">
          <span>Search chats</span>
          <DebouncedSearchInput
            value={search}
            onDebouncedChange={updateSearch}
            placeholder="Ticket, title, message, or sender"
            aria-label="Search chats"
            type="search"
          />
        </label>
      </div>

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
        <IllustratedEmptyState
          image={noChatsImage}
          title="No ticket chats yet"
          message="When a ticket conversation starts, it will appear here."
        />
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
      {!loading && !error && (page > 1 || hasMore) ? <div className="admin-pagination" aria-label="Chat pages"><button type="button" className="btn ghost" disabled={page === 1} onClick={() => updatePage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" className="btn ghost" disabled={!hasMore} onClick={() => updatePage(page + 1)}>Next</button></div> : null}
    </section>
  )
}

