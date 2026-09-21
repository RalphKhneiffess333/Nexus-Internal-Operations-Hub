import { Dialog } from '../ui/Dialog'

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busyLabel = confirmLabel,
  dismissLabel = 'Dismiss',
  confirmClassName = 'btn danger',
  busy,
  onConfirm,
  onDismiss,
}) {
  return (
    <Dialog role="alertdialog" ariaLabelledBy="confirm-title" onClose={onDismiss}>
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onDismiss} disabled={busy}>
            {dismissLabel}
          </button>
          <button
            type="button"
            className={confirmClassName}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
    </Dialog>
  )
}
