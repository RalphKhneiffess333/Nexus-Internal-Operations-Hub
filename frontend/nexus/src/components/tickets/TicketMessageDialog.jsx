import { useState } from 'react'

export function TicketMessageDialog({
  title,
  message,
  label,
  placeholder,
  confirmLabel,
  busyLabel,
  dismissLabel = 'Dismiss',
  busy,
  required = false,
  error = '',
  onConfirm,
  onDismiss,
}) {
  const [value, setValue] = useState('')
  const [fieldError, setFieldError] = useState('')

  function handleConfirm() {
    const trimmed = value.trim()
    if (required && !trimmed) {
      setFieldError('Please add a message before continuing.')
      return
    }

    setFieldError('')
    onConfirm(trimmed)
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onDismiss}>
      <div
        className="dialog clay-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="message-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="message-dialog-title">{title}</h2>
        <p>{message}</p>
        <label className="field">
          <span>{label}</span>
          <textarea
            rows="5"
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            disabled={busy}
          />
          {fieldError ? <em className="field-error">{fieldError}</em> : null}
        </label>
        {error ? <p className="banner error">{error}</p> : null}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onDismiss} disabled={busy}>
            {dismissLabel}
          </button>
          <button type="button" className="btn primary" onClick={handleConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
