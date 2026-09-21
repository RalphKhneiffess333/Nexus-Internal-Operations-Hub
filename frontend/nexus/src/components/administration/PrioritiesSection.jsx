import { useState } from 'react'
import { AdminConfirmDialog, AdminDialog } from './AdminDialog'

export function PrioritiesSection({ model, actions }) {
  const [priorityDialog, setPriorityDialog] = useState(null)
  const [deactivation, setDeactivation] = useState(null)

  async function deactivate() {
    await actions.updatePriorityStatus(deactivation.priorityId, false)
    setDeactivation(null)
  }

  return (
    <div className="admin-section">
      <div className="admin-toolbar"><div><p className="muted">Priorities control ticket routing labels and unclaimed-ticket reminder intervals.</p></div><button type="button" className="btn primary" onClick={() => setPriorityDialog({ priority: null })}>Add priority</button></div>
      <div className="admin-card-grid">{model.items.map((priority) => <PriorityCard key={priority.priorityId} priority={priority} onEdit={() => setPriorityDialog({ priority })} onDeactivate={() => setDeactivation(priority)} onStatusChange={actions.updatePriorityStatus} />)}</div>
      {!model.items.length ? <div className="empty-state"><h2>No priorities found</h2><p>Add a priority to make it available for new tickets.</p></div> : null}
      {priorityDialog ? <AdminDialog title={priorityDialog.priority ? 'Edit priority' : 'Add priority'} description="Set the label and reminder interval used by tickets with this priority." onClose={() => setPriorityDialog(null)}><PriorityForm priority={priorityDialog.priority} actions={actions} onDone={() => setPriorityDialog(null)} /></AdminDialog> : null}
      {deactivation ? <AdminConfirmDialog title="Deactivate priority?" description={`${deactivation.name} will remain visible for historical tickets but cannot be selected for new or updated tickets.`} confirmLabel="Deactivate priority" danger onConfirm={deactivate} onClose={() => setDeactivation(null)} /> : null}
    </div>
  )
}

function PriorityForm({ priority, actions, onDone }) {
  const [form, setForm] = useState({ code: priority?.code ?? '', name: priority?.name ?? '', reminderIntervalMinutes: priority?.reminderIntervalMinutes ?? 240 })

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    const payload = { ...form, reminderIntervalMinutes: Number(form.reminderIntervalMinutes) }
    const saved = await actions.savePriority(priority, priority ? { name: payload.name, reminderIntervalMinutes: payload.reminderIntervalMinutes } : payload)
    if (saved) onDone()
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-grid">
        <label className="field"><span>Code</span><input name="code" required disabled={Boolean(priority)} value={form.code} onChange={update} /></label>
        <label className="field"><span>Name</span><input name="name" required value={form.name} onChange={update} /></label>
        <label className="field"><span>Reminder interval (minutes)</span><input name="reminderIntervalMinutes" type="number" min="0" required value={form.reminderIntervalMinutes} onChange={update} /></label>
      </div>
      <div className="form-actions"><button type="submit" className="btn primary">Save priority</button><button type="button" className="btn ghost" onClick={onDone}>Cancel</button></div>
    </form>
  )
}

function PriorityCard({ priority, onEdit, onDeactivate, onStatusChange }) {
  return (
    <article className={`admin-card clay-card ${priority.active ? '' : 'is-inactive'}`}>
      <div className="admin-card-heading"><div><p className="eyebrow">{priority.code}</p><h3 className="admin-card-title">{priority.name}</h3></div><span className={`status-toggle ${priority.active ? 'is-active' : ''}`}>{priority.active ? 'Active' : 'Inactive'}</span></div>
      <p>Reminders every {priority.reminderIntervalMinutes} minutes.</p>
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onEdit}>Edit</button>
        {priority.active ? <button type="button" className="btn danger" onClick={onDeactivate}>Deactivate</button> : <button type="button" className="btn primary" onClick={() => void onStatusChange(priority.priorityId, true)}>Reactivate</button>}
      </div>
    </article>
  )
}
