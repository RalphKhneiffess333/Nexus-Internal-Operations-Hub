import { useState } from 'react'
import { Dialog } from '../../ui/Dialog/Dialog'

export function HandoffDialog({
  agents = [],
  busy = false,
  error = '',
  onConfirm,
  onDismiss,
}) {
  const [requestedAgentId, setRequestedAgentId] = useState('')
  const [message, setMessage] = useState('')
  const [fieldError, setFieldError] = useState('')

  function handleConfirm() {
    if (!requestedAgentId) {
      setFieldError('Choose an agent to receive this ticket.')
      return
    }

    setFieldError('')
    onConfirm({ requestedAgentId, message: message.trim() || undefined })
  }

  return (
    <Dialog wide ariaLabelledBy="handoff-dialog-title" onClose={onDismiss}>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Ticket handoff</p>
            <h2 id="handoff-dialog-title">Ask another agent to take over</h2>
            <p>Ownership stays with you until the selected agent accepts.</p>
          </div>
          <button
            type="button"
            className="dialog-close"
            aria-label="Close handoff dialog"
            onClick={onDismiss}
            disabled={busy}
          >
            ×
          </button>
        </div>

        <label className="field">
          <span>Agent</span>
          <select
            value={requestedAgentId}
            onChange={(event) => setRequestedAgentId(event.target.value)}
            disabled={busy}
          >
            <option value="">Select an eligible agent</option>
            {agents.map((agent) => (
              <option key={agent.userId} value={agent.userId}>
                {agent.fullName} · {agent.email}
              </option>
            ))}
          </select>
          {fieldError ? <em className="field-error">{fieldError}</em> : null}
        </label>

        <label className="field">
          <span>Message <small>(optional)</small></span>
          <textarea
            rows="4"
            maxLength="1000"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Add context for the receiving agent."
            disabled={busy}
          />
        </label>

        {error ? <p className="banner error">{error}</p> : null}

        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onDismiss} disabled={busy}>
            Keep ticket
          </button>
          <button type="button" className="btn primary" onClick={handleConfirm} disabled={busy || agents.length === 0}>
            {busy ? 'Sending…' : 'Send handoff'}
          </button>
        </div>
    </Dialog>
  )
}

