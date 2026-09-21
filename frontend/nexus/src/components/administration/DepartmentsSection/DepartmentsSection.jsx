import { useState } from 'react'
import { DebouncedSearchInput } from '../../ui/DebouncedSearchInput/DebouncedSearchInput'
import { AdminConfirmDialog, AdminDialog } from '../AdminDialog/AdminDialog'

export function DepartmentsSection({ model, actions, loading }) {
  const [departmentDialog, setDepartmentDialog] = useState(null)
  const [deactivation, setDeactivation] = useState(null)

  async function deactivate() {
    await actions.updateDepartmentStatus(deactivation.departmentId, false)
    setDeactivation(null)
  }

  return (
    <div className="admin-section">
      <div className="admin-toolbar">
        <label className="field admin-search">
          <span>Search departments</span>
          <DebouncedSearchInput value={model.search} onDebouncedChange={(value) => actions.updateDepartmentFilter('departmentSearch', value.trim())} placeholder="Code or name" aria-label="Search departments" type="search" />
        </label>
        <div><p className="muted">Inactive departments remain visible for historical records.</p></div>
        <button type="button" className="btn primary" onClick={() => setDepartmentDialog({ department: null })}>Add department</button>
      </div>
      <div className="admin-card-grid">{model.items.map((department) => <DepartmentCard key={department.departmentId} department={department} onEdit={() => setDepartmentDialog({ department })} onDeactivate={() => setDeactivation(department)} onStatusChange={actions.updateDepartmentStatus} />)}</div>
      {!loading && model.items.length === 0 ? <div className="empty-state"><h2>No departments found</h2><p>Try a different search or add a department.</p></div> : null}
      {!loading && model.total > 25 ? (
        <div className="admin-pagination" aria-label="Department pages">
          <button type="button" className="btn ghost" disabled={model.page === 1} onClick={() => actions.updateDepartmentPage(model.page - 1)}>Previous</button>
          <span>Page {model.page} of {Math.ceil(model.total / 25)}</span>
          <button type="button" className="btn ghost" disabled={model.page >= Math.ceil(model.total / 25)} onClick={() => actions.updateDepartmentPage(model.page + 1)}>Next</button>
        </div>
      ) : null}
      {departmentDialog ? <AdminDialog title={departmentDialog.department ? 'Edit department' : 'Add department'} description={departmentDialog.department ? 'Update the department details used throughout Nexus.' : 'Create a department for routing and ticket ownership.'} wide onClose={() => setDepartmentDialog(null)}><DepartmentForm department={departmentDialog.department} actions={actions} onDone={() => setDepartmentDialog(null)} /></AdminDialog> : null}
      {deactivation ? <AdminConfirmDialog title="Deactivate department?" description={`${deactivation.name} will remain visible for historical records but will no longer accept new assignments.`} confirmLabel="Deactivate department" danger onConfirm={deactivate} onClose={() => setDeactivation(null)} /> : null}
    </div>
  )
}

function DepartmentForm({ department, actions, onDone }) {
  const [form, setForm] = useState({ code: department?.code ?? '', name: department?.name ?? '', description: department?.desc ?? '' })

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    const saved = await actions.saveDepartment(department, form)
    if (saved) onDone()
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-grid">
        <label className="field"><span>Code</span><input name="code" required value={form.code} onChange={update} /></label>
        <label className="field"><span>Name</span><input name="name" required value={form.name} onChange={update} /></label>
        <label className="field field-wide"><span>Description</span><textarea name="description" required value={form.description} onChange={update} /></label>
      </div>
      <div className="form-actions"><button type="submit" className="btn primary">Save department</button><button type="button" className="btn ghost" onClick={onDone}>Cancel</button></div>
    </form>
  )
}

function DepartmentCard({ department, onEdit, onDeactivate, onStatusChange }) {
  return (
    <article className={`admin-card clay-card ${department.active ? '' : 'is-inactive'}`}>
      <div className="admin-card-heading"><div><p className="eyebrow">{department.code}</p><h3 className="admin-card-title">{department.name}</h3></div><span className={`status-toggle ${department.active ? 'is-active' : ''}`}>{department.active ? 'Active' : 'Inactive'}</span></div>
      <p>{department.desc}</p>
      <p className="muted">{department._count?.members ?? 0} members · {department._count?.tickets ?? 0} tickets</p>
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onEdit}>Edit</button>
        {department.active ? <button type="button" className="btn danger" onClick={onDeactivate}>Deactivate</button> : <button type="button" className="btn primary" onClick={() => void onStatusChange(department.departmentId, true)}>Reactivate</button>}
      </div>
    </article>
  )
}

