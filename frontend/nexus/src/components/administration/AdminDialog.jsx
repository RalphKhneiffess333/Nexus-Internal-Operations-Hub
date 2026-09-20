import { useState } from 'react'
import { Dialog } from '../ui/Dialog'

export function AdminDialog({ title, description, children, onClose, wide = false }) {
  return (
    <Dialog wide={wide} ariaLabel={title} onClose={onClose}>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Administration</p>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="dialog-close" aria-label="Close dialog" onClick={onClose}>×</button>
        </div>
        {children}
    </Dialog>
  )
}

export function AdminConfirmDialog({ title, description, confirmLabel, danger = false, onConfirm, onClose }) {
  const [submitting, setSubmitting] = useState(false)

  async function confirm() {
    setSubmitting(true)
    await onConfirm()
    setSubmitting(false)
  }

  return (
    <AdminDialog title={title} description={description} onClose={onClose}>
      <div className="dialog-actions">
        <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>Cancel</button>
        <button type="button" className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => void confirm()} disabled={submitting}>
          {submitting ? 'Saving...' : confirmLabel}
        </button>
      </div>
    </AdminDialog>
  )
}
