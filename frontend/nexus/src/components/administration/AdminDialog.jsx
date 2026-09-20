import { useEffect, useState } from 'react'

export function AdminDialog({ title, description, children, onClose, wide = false }) {
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`dialog clay-card ${wide ? 'dialog-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Administration</p>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="dialog-close" aria-label="Close dialog" onClick={onClose}>×</button>
        </div>
        {children}
      </section>
    </div>
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
