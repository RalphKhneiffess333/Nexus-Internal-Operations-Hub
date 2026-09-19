import { useCallback, useEffect, useMemo, useState } from 'react'
import { UserLink } from '../users/UserLink'
import { FilePicker } from './FilePicker'
import { formatDateTime } from '../../features/tickets/ticket-types'
import {
  createChatMessage,
  downloadChatAttachment,
  getChatMessages,
  openChatAttachment,
} from '../../features/tickets/ticket-api'
import { useOperationsSocket } from '../../features/realtime/use-operations-socket'

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

export function TicketChatPanel({ ticket, currentUser }) {
  const { connectionState, subscribeToChat } = useOperationsSocket()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState([])
  const [filePickerResetKey, setFilePickerResetKey] = useState(0)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState('')
  const ticketId = ticket?.ticketId

  const writable = ticket?.active !== false && ticket?.status === 'CLAIMED' &&
    (ticket?.submittedBy?.userId === currentUser?.userId || ticket?.agent?.userId === currentUser?.userId)

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const result = await getChatMessages(ticketId)
      setMessages((current) => mergeMessages(current, Array.isArray(result) ? result : []))
    } catch (loadError) {
      if (!silent) setError(loadError.message || 'Unable to load the conversation.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    // The authoritative history request intentionally synchronizes this panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages()
  }, [loadMessages])

  useEffect(() => subscribeToChat(ticketId, (event) => {
    if (event?.type === 'reconnected') {
      void loadMessages({ silent: true })
      return
    }
    if (event?.payload?.messageId) {
      setMessages((current) => mergeMessages(current, [event.payload]))
    }
  }), [loadMessages, subscribeToChat, ticket?.status, ticketId])

  useEffect(() => {
    // Ticket lifecycle changes can change room access and writability.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages({ silent: true })
  }, [loadMessages, ticket?.status])

  async function handleSend(event) {
    event.preventDefault()
    if (sending || (!content.trim() && files.length === 0)) return

    setSending(true)
    setSendError('')
    try {
      const created = await createChatMessage(ticket.ticketId, content.trim(), files)
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
      await openChatAttachment(ticket.ticketId, messageId, attachment.attachmentId)
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
    <section className="ticket-chat-panel clay-card" aria-labelledby="ticket-chat-heading">
      <div className="ticket-chat-heading">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2 id="ticket-chat-heading">Ticket chat</h2>
        </div>
        <span className="ticket-chat-count">{messages.length}</span>
      </div>

      {connectionNote ? <p className="ticket-chat-connection">{connectionNote}</p> : null}
      {loading ? <p className="ticket-chat-state">Loading conversation…</p> : null}
      {!loading && error ? <div className="ticket-chat-state ticket-chat-error"><p>{error}</p><button type="button" className="btn ghost" onClick={() => void loadMessages()}>Try again</button></div> : null}
      {!loading && !error && messages.length === 0 ? <p className="ticket-chat-state">No messages yet. {writable ? 'Start the conversation.' : 'This conversation is read-only.'}</p> : null}

      {!loading && messages.length > 0 ? (
        <ol className="ticket-chat-list">
          {messages.map((message) => (
            <li key={message.messageId} className={`ticket-chat-message${message.sender?.userId === currentUser?.userId ? ' is-mine' : ''}`}>
              <div className="ticket-chat-message-meta"><UserLink user={message.sender} /><time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time></div>
              {message.content ? <p>{message.content}</p> : null}
              {message.attachments?.length ? <ul className="ticket-chat-attachments">{message.attachments.map((attachment) => <li key={attachment.attachmentId}><div><button type="button" className="ticket-chat-attachment-name" onClick={() => void handleOpen(message.messageId, attachment)} disabled={downloadingAttachmentId === attachment.attachmentId}>📎 <span>{attachment.originalName}</span></button><button type="button" className="ticket-chat-attachment-download" onClick={() => void handleDownload(message.messageId, attachment.attachmentId)} disabled={downloadingAttachmentId === attachment.attachmentId}>{downloadingAttachmentId === attachment.attachmentId ? 'Working…' : 'Download'}</button></div></li>)}</ul> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {writable ? (
        <form className="ticket-chat-composer" onSubmit={handleSend}>
          <label htmlFor={`chat-message-${ticket.ticketId}`}>New message</label>
          <textarea id={`chat-message-${ticket.ticketId}`} value={content} onChange={(event) => setContent(event.target.value)} maxLength={4000} rows="3" placeholder="Write a message…" disabled={sending} />
          <FilePicker key={filePickerResetKey} onChange={setFiles} disabled={sending} />
          {sendError ? <p className="ticket-chat-send-error">{sendError}</p> : null}
          <div className="ticket-chat-actions"><span>{content.length}/4000</span><button type="submit" className="btn primary" disabled={sending || (!content.trim() && files.length === 0)}>{sending ? 'Sending…' : 'Send message'}</button></div>
        </form>
      ) : (
        <p className="ticket-chat-read-only">This chat is read-only while the ticket is unclaimed.</p>
      )}
    </section>
  )
}
