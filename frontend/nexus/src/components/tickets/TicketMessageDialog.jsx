import { useState } from 'react'
import { FilePicker } from './FilePicker'
import { Dialog } from '../ui/Dialog'

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
  includeAttachments = false,
}) {
  const [value, setValue] = useState('')
  const [files, setFiles] = useState([])
  const [fieldError, setFieldError] = useState('')

  function handleConfirm() {
    const trimmed = value.trim()
    if (required && !trimmed) {
      setFieldError('Please add a message before continuing.')
      return
    }

    setFieldError('')
    onConfirm(trimmed, files)
  }

  return (
    <Dialog role="alertdialog" ariaLabelledBy="message-dialog-title" onClose={onDismiss}>
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
        {includeAttachments ? (
          <div className="field">
            <span>Attachments <small>(optional, up to 5 files)</small></span>
            <FilePicker onChange={setFiles} disabled={busy} />
          </div>
        ) : null}
        {error ? <p className="banner error">{error}</p> : null}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onDismiss} disabled={busy}>
            {dismissLabel}
          </button>
          <button type="button" className="btn primary" onClick={handleConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
    </Dialog>
  )
}
