import { useLayoutEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useNavigate } from 'react-router-dom'
import { sendAssistantMessage } from '../../features/assistant/assistant-api'
import styles from './AssistantPage.module.css'

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Tell me what happened and I’ll help you work through it. If a submission is still needed, I’ll ask before prefilling the form.',
}

function isSafeMarkdownUrl(url) {
  if (!url) return false

  try {
    const protocol = new URL(url, window.location.origin).protocol
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:'
  } catch {
    return false
  }
}

export function AssistantPage() {
  const navigate = useNavigate()
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const messagesRef = useRef(null)

  useLayoutEffect(() => {
    const messageList = messagesRef.current
    if (messageList) messageList.scrollTop = messageList.scrollHeight
  }, [messages.length, sending])

  async function handleSubmit(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || sending) return

    setDraft('')
    setError('')
    setMessages((current) => [
      ...current,
      { id: String(Date.now()) + '-user', role: 'user', content: message },
    ])
    setSending(true)

    try {
      const response = await sendAssistantMessage(message, conversationId)
      if (response?.conversationId) setConversationId(response.conversationId)
      setMessages((current) => [
        ...current,
        {
          id: String(Date.now()) + '-assistant',
          role: 'assistant',
          content: response?.message || 'I could not prepare a response.',
          action: response?.action,
        },
      ])
    } catch (sendError) {
      setError(sendError.message || 'The assistant is temporarily unavailable. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="ticket-chat-full" aria-labelledby="assistant-chat-heading">
      <div className="ticket-chat-heading ticket-chat-full-heading">
        <span id="assistant-chat-heading">Nexus assistant conversation</span>
      </div>

      <ol ref={messagesRef} className={`ticket-chat-list ${styles.messageList}`} aria-live="polite">
        {messages.map((item) => (
          <li
            className={`ticket-chat-message${item.role === 'user' ? ' is-mine' : ''}`}
            key={item.id}
          >
            <div className="ticket-chat-message-meta">
              <span className={styles.messageAuthor}>
                {item.role === 'user' ? 'You' : 'Nexus assistant'}
              </span>
            </div>
            {item.role === 'assistant' ? (
              <div className={styles.messageContent}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  skipHtml
                  components={{
                    a: ({ href, children }) =>
                      isSafeMarkdownUrl(href) ? (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ) : (
                        <span>{children}</span>
                      ),
                  }}
                >
                  {item.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p>{item.content}</p>
            )}
            {item.action?.type === 'PREFILL_TICKET' ? (
              <div className={styles.prefill}>
                <p>I can open the submission form with these suggestions filled in for you to review.</p>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
                    navigate('/tickets/new', {
                      state: { prefill: item.action.data },
                    })
                  }
                >
                  Prefill form
                </button>
              </div>
            ) : null}
          </li>
        ))}
        {sending ? (
          <li className="ticket-chat-message">
            <div className="ticket-chat-message-meta">
              <span className={styles.messageAuthor}>Nexus assistant</span>
            </div>
            <span className={styles.typing}>Thinking…</span>
          </li>
        ) : null}
      </ol>

      <form className="ticket-chat-composer" onSubmit={handleSubmit}>
        <label htmlFor="assistant-message">New message</label>
        <textarea
          id="assistant-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="For example: My laptop keeps disconnecting from the office Wi-Fi…"
          maxLength={4000}
          rows="3"
          disabled={sending}
        />
        {error ? <p className="ticket-chat-send-error">{error}</p> : null}
        <div className="ticket-chat-actions">
          <span>{draft.length}/4000</span>
          <button type="submit" className="btn primary" disabled={sending || !draft.trim()}>
            {sending ? 'Sending…' : 'Send message'}
          </button>
        </div>
      </form>
    </section>
  )
}
