import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendAssistantMessage } from '../../features/assistant/assistant-api'
import styles from './AssistantPage.module.css'

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Tell me what happened and I’ll help you work through it. If a submission is still needed, I’ll ask before prefilling the form.',
}

export function AssistantPage() {
  const navigate = useNavigate()
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const messagesRef = useRef(null)

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
      requestAnimationFrame(() => {
        messagesRef.current?.scrollTo({
          top: messagesRef.current.scrollHeight,
          behavior: 'smooth',
        })
      })
    } catch (sendError) {
      setError(sendError.message || 'The assistant is temporarily unavailable. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className={[styles.page, 'page'].join(' ')}>
      <header className={[styles.header, 'page-header'].join(' ')}>
        <div>
          <p className="eyebrow">Nexus assistant</p>
          <h1>Let’s shape your request</h1>
          <p>
            Describe a workplace problem in your own words. The assistant will
            help with guidance first and leave any final review and submission
            to you.
          </p>
        </div>
      </header>

      <div className={styles.workspace}>
        <div className={styles.messages} ref={messagesRef} aria-live="polite">
          {messages.map((item) => (
            <article
              className={[
                styles.message,
                item.role === 'user' ? styles.messageUser : '',
              ].join(' ')}
              key={item.id}
            >
              <span className={styles.messageLabel}>
                {item.role === 'user' ? 'You' : 'Nexus assistant'}
              </span>
              <p>{item.content}</p>
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
            </article>
          ))}
          {sending ? (
            <div className={styles.message}>
              <span className={styles.messageLabel}>Nexus assistant</span>
              <span className={styles.typing}>Thinking…</span>
            </div>
          ) : null}
        </div>

        <form className={styles.composer} onSubmit={handleSubmit}>
          {error ? <p className={styles.error}>{error}</p> : null}
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="For example: My laptop keeps disconnecting from the office Wi-Fi…"
            maxLength={4000}
            disabled={sending}
            aria-label="Message the Nexus assistant"
          />
          <button type="submit" className="btn primary" disabled={sending || !draft.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  )
}
