export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onDismiss,
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onDismiss}>
      <div
        className="dialog clay-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onDismiss} disabled={busy}>
            Keep Ticket
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Cancelling...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
