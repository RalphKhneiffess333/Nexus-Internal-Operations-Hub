import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { UserLink } from '../users/UserLink'
import { FilePicker } from './FilePicker'
import noChatsImage from '../../assets/NoChats.png'
import { IllustratedEmptyState } from '../ui/IllustratedEmptyState'
import { formatDateTime } from '../../features/tickets/ticket-types'
import {
  createChatMessage,
  downloadChatAttachment,
  getChatMessages,
  openChatAttachment,
} from '../../features/tickets/ticket-api'
import { useOperationsSocket } from '../../features/realtime/use-operations-socket'
import { sanitizePlainText } from '../../lib/content/sanitize'
import { useLatestRequest } from '../../lib/api/use-latest-request'
import { MAX_CHAT_MESSAGE_LENGTH } from './ticket-validation'

function sortMessages(messages) {
  return [...messages].sort((left, right) => {
    const timestamp = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    return timestamp || left.messageId.localeCompare(right.messageId)
  })
}

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.messageId, message]))
  incoming.forEach((message) => byId.set(message.messageId, message))
  return sortMessages([...byId.values()])
}

export function TicketChatPanel({
  ticket,
  currentUser,
  onConversationRead,
  variant = 'panel',
}) {
  const { connectionState, subscribeToChat } = useOperationsSocket()
  const [messages, setMessages] = useState([])
  const [messagePage, setMessagePage] = useState(1)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState([])
  const [filePickerResetKey, setFilePickerResetKey] = useState(0)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState('')
  const messageListRef = useRef(null)
  const messagePageRef = useRef(1)
  const shouldFollowLatestRef = useRef(true)
  const ticketId = ticket?.ticketId
  const { beginRequest } = useLatestRequest()

  const writable = ticket?.active !== false && ticket?.status === 'CLAIMED' &&
    (ticket?.submittedBy?.userId === currentUser?.userId || ticket?.agent?.userId === currentUser?.userId)

  const loadMessages = useCallback(async ({ silent = false, append = false, nextPage = 1 } = {}) => {
    const request = beginRequest()
    if (!silent) {
      if (append) setLoadingMoreMessages(true)
      else setLoading(true)
      setError('')
    }
    try {
      const result = await getChatMessages(
        ticketId,
        { page: nextPage, pageSize: 50 },
        { signal: request.controller.signal },
      )
      if (!request.isCurrent()) return
      const incoming = result?.items ?? (Array.isArray(result) ? result : [])
      setMessages((current) => (append || silent ? mergeMessages(current, incoming) : incoming))
      const highestPage = Math.max(messagePageRef.current, nextPage)
      messagePageRef.current = highestPage
      setMessagePage(highestPage)
      if (nextPage === highestPage) setHasMoreMessages(Boolean(result?.hasMore))
    } catch (loadError) {
      if (request.isCurrent() && !silent) {
        setError(loadError.message || 'Unable to load the conversation.')
      }
    } finally {
      if (request.isCurrent()) {
        if (append) {
          setLoadingMoreMessages(false)
        } else {
          setLoading(false)
          setLoadingMoreMessages(false)
        }
      }
    }
  }, [beginRequest, ticketId])

  useEffect(() => {
    // Reset paginated history when the selected ticket changes.
    messagePageRef.current = 1
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessagePage(1)
    setHasMoreMessages(false)
    setMessages([])
  }, [ticketId])

  useEffect(() => {
    // The authoritative history request intentionally synchronizes this panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages()
    void onConversationRead?.()
  }, [loadMessages, onConversationRead])

  useEffect(() => subscribeToChat(ticketId, (event) => {
    if (event?.type === 'reconnected') {
      void loadMessages({ silent: true })
      return
    }
    if (event?.payload?.messageId) {
      setMessages((current) => mergeMessages(current, [event.payload]))
      if (event.payload.sender?.userId !== currentUser?.userId) {
        void onConversationRead?.()
      }
    }
  }), [currentUser?.userId, loadMessages, onConversationRead, subscribeToChat, ticket?.status, ticketId])

  useLayoutEffect(() => {
    if (!shouldFollowLatestRef.current) return
    const messageList = messageListRef.current
    if (messageList) messageList.scrollTop = messageList.scrollHeight
  }, [messages.length])

  function handleMessageListScroll(event) {
    const { clientHeight, scrollHeight, scrollTop } = event.currentTarget
    shouldFollowLatestRef.current = scrollHeight - clientHeight - scrollTop < 40
  }

  async function handleSend(event) {
    event.preventDefault()
    const sanitizedContent = sanitizePlainText(content)
    if (sending || (!sanitizedContent && files.length === 0)) return
    if (sanitizedContent.length > MAX_CHAT_MESSAGE_LENGTH) {
      setSendError(`Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer.`)
      return
    }

    setSending(true)
    setSendError('')
    try {
      const created = await createChatMessage(ticket.ticketId, sanitizedContent, files)
      shouldFollowLatestRef.current = true
      setMessages((current) => mergeMessages(current, [created]))
      setContent('')
      setFiles([])
      setFilePickerResetKey((value) => value + 1)
    } catch (sendFailure) {
      setSendError(sendFailure.message || 'Unable to send this message.')
    } finally {
      setSending(false)
    }
  }

  async function handleOpen(messageId, attachment) {
    setDownloadingAttachmentId(attachment.attachmentId)
    try {
      await openChatAttachment(ticket.ticketId, messageId, attachment.attachmentId, {
        mimeType: attachment.mimeType,
        filename: attachment.originalName,
      })
    } catch (openError) {
      setError(openError.message || 'Unable to open this attachment.')
    } finally {
      setDownloadingAttachmentId('')
    }
  }

  async function handleDownload(messageId, attachmentId) {
    setDownloadingAttachmentId(attachmentId)
    try {
      await downloadChatAttachment(ticket.ticketId, messageId, attachmentId)
    } catch (downloadError) {
      setError(downloadError.message || 'Unable to download this attachment.')
    } finally {
      setDownloadingAttachmentId('')
    }
  }

  const connectionNote = useMemo(() => {
    if (connectionState === 'reconnecting') return 'Reconnecting — synchronizing chat…'
    if (connectionState === 'error') return 'Live updates are unavailable; refresh to synchronize.'
    return null
  }, [connectionState])

  return (
    <section className={`ticket-chat-panel ticket-chat-${variant} clay-card`} aria-labelledby="ticket-chat-heading">
      {variant === 'panel' ? (
        <div className="ticket-chat-heading">
          <div>
            <p className="eyebrow">Conversation</p>
            <h2 id="ticket-chat-heading">Ticket chat</h2>
          </div>
          <span className="ticket-chat-count">{messages.length}</span>
        </div>
      ) : (
        <div className="ticket-chat-heading ticket-chat-full-heading">
          <span id="ticket-chat-heading">Conversation</span>
          <span className="ticket-chat-count">{messages.length}</span>
        </div>
      )}

      {connectionNote ? <p className="ticket-chat-connection">{connectionNote}</p> : null}
      {loading ? (
        <div className="ticket-chat-state ticket-chat-loading" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <span>Loading conversation…</span>
        </div>
      ) : null}
      {!loading && error ? <div className="ticket-chat-state ticket-chat-error"><p>{error}</p><button type="button" className="btn ghost" onClick={() => void loadMessages()}>Try again</button></div> : null}
      {!loading && !error && messages.length === 0 ? (
        <IllustratedEmptyState
          className="ticket-chat-empty-state"
          image={noChatsImage}
          title="No messages yet"
          message={writable ? 'Start the conversation.' : 'This conversation is read-only.'}
        />
      ) : null}

      {!loading && messages.length > 0 ? (
        <ol
          ref={messageListRef}
          className="ticket-chat-list"
          onScroll={handleMessageListScroll}
        >
          {messages.map((message) => (
            <li key={message.messageId} className={`ticket-chat-message${message.sender?.userId === currentUser?.userId ? ' is-mine' : ''}`}>
              <div className="ticket-chat-message-meta"><UserLink user={message.sender} /><time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time></div>
              {message.content ? <p>{message.content}</p> : null}
              {message.attachments?.length ? <ul className="ticket-chat-attachments">{message.attachments.map((attachment) => <li key={attachment.attachmentId}><div><button type="button" className="ticket-chat-attachment-name" onClick={() => void handleOpen(message.messageId, attachment)} disabled={downloadingAttachmentId === attachment.attachmentId}>📎 <span>{attachment.originalName}</span></button><button type="button" className="ticket-chat-attachment-download" onClick={() => void handleDownload(message.messageId, attachment.attachmentId)} disabled={downloadingAttachmentId === attachment.attachmentId}>{downloadingAttachmentId === attachment.attachmentId ? 'Working…' : 'Download'}</button></div></li>)}</ul> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {!loading && !error && hasMoreMessages ? (
        <button
          type="button"
          className="btn ghost"
          onClick={() => void loadMessages({ append: true, nextPage: messagePage + 1 })}
          disabled={loadingMoreMessages}
        >
          {loadingMoreMessages ? 'Loading older messages…' : 'Load older messages'}
        </button>
      ) : null}

      {writable ? (
        <form className="ticket-chat-composer" onSubmit={handleSend}>
          <label htmlFor={`chat-message-${ticket.ticketId}`}>New message</label>
          <textarea id={`chat-message-${ticket.ticketId}`} value={content} onChange={(event) => setContent(event.target.value)} maxLength={MAX_CHAT_MESSAGE_LENGTH} rows="3" placeholder="Write a message…" disabled={sending} />
          <FilePicker key={filePickerResetKey} onChange={setFiles} disabled={sending} />
          {sendError ? <p className="ticket-chat-send-error">{sendError}</p> : null}
          <div className="ticket-chat-actions"><span>{content.length}/{MAX_CHAT_MESSAGE_LENGTH}</span><button type="submit" className="btn primary" disabled={sending || (!content.trim() && files.length === 0)}>{sending ? 'Sending…' : 'Send message'}</button></div>
        </form>
      ) : (
        <p className="ticket-chat-read-only">This chat is read-only because the ticket is not currently claimed.</p>
      )}
    </section>
  )
}
