import { useCallback, useEffect, useState } from 'react'
import { LoadingState } from '../../components/ui/LoadingState'
import { UserLink } from '../../components/users/UserLink'
import { UserRole } from '../../features/tickets/ticket-types'
import {
  addUserDepartment,
  createAdminDepartment,
  createAdminUser,
  deactivateAdminDepartment,
  getAdminConfigurations,
  getAdminDepartments,
  getAdminUsers,
  reactivateAdminDepartment,
  removeUserDepartment,
  updateAdminConfiguration,
  updateAdminDepartment,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '../../features/administration/administration-api'

const sections = [
  { id: 'users', label: 'Users' },
  { id: 'departments', label: 'Departments' },
  { id: 'configurations', label: 'Configuration' },
]

function messageFor(error, fallback) {
  return error?.message || fallback
}

export function ManagementPage() {
  const [section, setSection] = useState('users')
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [configurations, setConfigurations] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [userStatus, setUserStatus] = useState('')
  const [userDepartmentId, setUserDepartmentId] = useState('')
  const [userHasLogged, setUserHasLogged] = useState('')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const loadData = useCallback(async () => {
    setError('')
    try {
      const [userResult, departmentResult, configurationResult] = await Promise.all([
        getAdminUsers({ page: 1, pageSize: 100, search, status: userStatus, departmentId: userDepartmentId, hasLogged: userHasLogged }),
        getAdminDepartments({ page: 1, pageSize: 100 }),
        getAdminConfigurations(),
      ])
      setUsers(userResult?.items ?? [])
      setDepartments(departmentResult?.items ?? [])
      setConfigurations(configurationResult ?? [])
    } catch (loadError) {
      setError(messageFor(loadError, 'Unable to load management data.'))
    } finally {
      setLoading(false)
    }
  }, [search, userStatus, userDepartmentId, userHasLogged])

  useEffect(() => {
    // This effect owns the async data synchronization for the selected search.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  async function runMutation(mutation, successMessage) {
    setError('')
    setNotice('')
    try {
      await mutation()
      setNotice(successMessage)
      await loadData()
      return true
    } catch (mutationError) {
      setError(messageFor(mutationError, 'The change could not be saved.'))
      return false
    }
  }

  return (
    <section className="page administration-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Management</h1>
          <p className="page-description">
            Manage Nexus accounts, departments, and supported operational settings.
          </p>
        </div>
      </header>

      {error ? <div className="banner error"><p>{error}</p><button type="button" className="btn ghost" onClick={loadData}>Try again</button></div> : null}
      {notice ? <p className="banner success">{notice}</p> : null}

      <div className="pool-switcher" role="tablist" aria-label="Management sections">
        {sections.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? 'is-active' : ''} onClick={() => setSection(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingState>Loading management data...</LoadingState> : null}
      {!loading && section === 'users' ? <UsersSection users={users} departments={departments} selectedUserId={selectedUserId} search={searchInput} onSearch={setSearchInput} userStatus={userStatus} onUserStatus={setUserStatus} userDepartmentId={userDepartmentId} onUserDepartment={setUserDepartmentId} userHasLogged={userHasLogged} onUserHasLogged={setUserHasLogged} onSelect={setSelectedUserId} showCreate={showCreateUser} setShowCreate={setShowCreateUser} runMutation={runMutation} /> : null}
      {!loading && section === 'departments' ? <DepartmentsSection departments={departments} runMutation={runMutation} /> : null}
      {!loading && section === 'configurations' ? <ConfigurationsSection configurations={configurations} runMutation={runMutation} /> : null}
    </section>
  )
}

function UsersSection({ users, departments, selectedUserId, search, onSearch, userStatus, onUserStatus, userDepartmentId, onUserDepartment, userHasLogged, onUserHasLogged, onSelect, showCreate, setShowCreate, runMutation }) {
  const [pendingAction, setPendingAction] = useState(null)
  const [departmentUserId, setDepartmentUserId] = useState('')
  const departmentUser = users.find((user) => user.userId === departmentUserId) ?? null

  async function confirmPendingAction() {
    if (pendingAction.type === 'role') {
      await runMutation(
        () => updateAdminUserRole(pendingAction.user.userId, pendingAction.role),
        'User role updated.',
      )
    } else {
      const active = !pendingAction.user.isActive
      const action = active ? 'reactivated' : 'deactivated'
      await runMutation(
        () => updateAdminUserStatus(pendingAction.user.userId, active),
        `User ${action}.`,
      )
    }
    setPendingAction(null)
  }

  return (
    <div className="admin-section">
      <div className="admin-toolbar">
        <label className="field admin-search">
          <span>Search users</span>
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Name or email" />
        </label>
        <div className="admin-filter-group"><label className="field admin-filter"><span>Status</span><select value={userStatus} onChange={(event) => onUserStatus(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label className="field admin-filter"><span>Department</span><select value={userDepartmentId} onChange={(event) => onUserDepartment(event.target.value)}><option value="">All departments</option>{departments.map((department) => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}</select></label><label className="field admin-filter"><span>Login</span><select value={userHasLogged} onChange={(event) => onUserHasLogged(event.target.value)}><option value="">Any login status</option><option value="true">Has logged in</option><option value="false">Has not logged in</option></select></label></div>
        <button type="button" className="btn primary" onClick={() => setShowCreate(true)}>Pre-provision user</button>
      </div>

      {showCreate ? (
        <AdminDialog title="Pre-provision a user" description="Create an account that will be linked to Microsoft Entra ID on first verified login." wide onClose={() => setShowCreate(false)}>
          <CreateUserForm runMutation={runMutation} onDone={() => setShowCreate(false)} />
        </AdminDialog>
      ) : null}

      <div className="admin-table-wrap clay-card">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Login</th><th>Departments</th></tr></thead>
          <tbody>
            {users.map((user) => <UserRow key={user.userId} user={user} selected={selectedUserId === user.userId} onSelect={() => { onSelect(user.userId); setDepartmentUserId(user.userId) }} onRequestAction={setPendingAction} />)}
          </tbody>
        </table>
        {users.length === 0 ? <div className="empty-state"><h2>No users found</h2><p>Try a different search or pre-provision a user.</p></div> : null}
      </div>
      {departmentUser ? <AdminDialog title="Department mapping" description={`${departmentUser.fullName} · ${departmentUser.role}`} wide onClose={() => setDepartmentUserId('')}><UserDepartmentEditor user={departmentUser} departments={departments} runMutation={runMutation} /></AdminDialog> : null}

      {pendingAction ? (
        <ConfirmDialog
          title={pendingAction.type === 'role' ? 'Change user role?' : `${pendingAction.user.isActive ? 'Deactivate' : 'Reactivate'} user?`}
          description={pendingAction.type === 'role' ? `Change ${pendingAction.user.fullName}'s role to ${pendingAction.role}?` : `Are you sure you want to ${pendingAction.user.isActive ? 'deactivate' : 'reactivate'} ${pendingAction.user.fullName}?`}
          confirmLabel={pendingAction.type === 'role' ? 'Change role' : pendingAction.user.isActive ? 'Deactivate user' : 'Reactivate user'}
          danger={pendingAction.type !== 'role' || pendingAction.user.isActive}
          onConfirm={confirmPendingAction}
          onClose={() => setPendingAction(null)}
        />
      ) : null}
    </div>
  )
}

function UserRow({ user, selected, onSelect, onRequestAction }) {
  function changeRole(event) {
    const role = event.target.value
    if (role !== user.role) onRequestAction({ type: 'role', user, role })
  }

  function toggleStatus() {
    onRequestAction({ type: 'status', user })
  }

  return <tr className={selected ? 'is-selected' : ''} onClick={onSelect}>
    <td><UserLink user={user} /><span className="admin-subtext">{user.email}</span></td>
    <td><select aria-label={`Role for ${user.fullName}`} value={user.role} onChange={changeRole} onClick={(event) => event.stopPropagation()}><option value={UserRole.EMPLOYEE}>Employee</option><option value={UserRole.AGENT}>Agent</option><option value={UserRole.ADMIN}>Admin</option></select></td>
    <td><button type="button" className={`status-toggle ${user.isActive ? 'is-active' : ''}`} onClick={(event) => { event.stopPropagation(); toggleStatus() }}>{user.isActive ? 'Active' : 'Inactive'}</button></td>
    <td>{user.hasLogged ? 'Logged in' : 'Not yet'}</td>
    <td>{user.departments?.length ? user.departments.map((department) => department.code).join(', ') : '—'}</td>
  </tr>
}

function CreateUserForm({ runMutation, onDone }) {
  const [form, setForm] = useState({ email: '', fullName: '', phoneNumber: '', role: UserRole.EMPLOYEE })
  function update(event) { setForm({ ...form, [event.target.name]: event.target.value }) }
  async function submit(event) {
    event.preventDefault()
    const saved = await runMutation(() => createAdminUser(form), 'User pre-provisioned.')
    if (saved) onDone()
  }
  return <form className="admin-form" onSubmit={submit}>
    <div className="admin-form-grid"><label className="field"><span>Full name</span><input name="fullName" required value={form.fullName} onChange={update} /></label><label className="field"><span>Email</span><input name="email" type="email" required value={form.email} onChange={update} /></label><label className="field"><span>Phone</span><input name="phoneNumber" value={form.phoneNumber} onChange={update} /></label><label className="field"><span>Initial role</span><select name="role" value={form.role} onChange={update}><option value={UserRole.EMPLOYEE}>Employee</option><option value={UserRole.AGENT}>Agent</option><option value={UserRole.ADMIN}>Admin</option></select></label></div>
    <div className="form-actions"><button type="submit" className="btn primary">Create account</button><button type="button" className="btn ghost" onClick={onDone}>Cancel</button></div>
  </form>
}

function UserDepartmentEditor({ user, departments, runMutation }) {
  const cannotMap = user.role === UserRole.EMPLOYEE
  return <div className="admin-detail"><div><p className="eyebrow">Department membership</p>{cannotMap ? <div className="mapping-notice"><strong>Department mapping unavailable</strong><p>Employees cannot be assigned to departments. Change this user to an agent or administrator first.</p></div> : <p className="muted">Select the departments this {user.role.toLowerCase()} can work in.</p>}</div>{!cannotMap && departments.length ? <div className="membership-grid">{departments.map((department) => { const member = user.departments?.some((item) => item.departmentId === department.departmentId); const disabled = !department.active && !member; return <label key={department.departmentId} className={`membership-option ${member ? 'is-member' : ''} ${disabled ? 'is-disabled' : ''}`}><input type="checkbox" checked={member} disabled={disabled} onChange={() => runMutation(member ? () => removeUserDepartment(user.userId, department.departmentId) : () => addUserDepartment(user.userId, department.departmentId), `${department.name} membership updated.`)} /><span>{department.name}<small>{department.active ? department.code : member ? 'Inactive · assigned' : 'Inactive · unavailable'}</small></span></label> })}</div> : null}{!cannotMap && !departments.length ? <p className="mapping-notice">No departments are available for mapping.</p> : null}</div>
}

function DepartmentsSection({ departments, runMutation }) {
  const [departmentDialog, setDepartmentDialog] = useState(null)
  const [deactivation, setDeactivation] = useState(null)

  async function deactivate() {
    await runMutation(() => deactivateAdminDepartment(deactivation.departmentId), 'Department deactivated.')
    setDeactivation(null)
  }

  return <div className="admin-section">
    <div className="admin-toolbar"><div><p className="muted">Inactive departments remain visible for historical records.</p></div><button type="button" className="btn primary" onClick={() => setDepartmentDialog({ department: null })}>Add department</button></div>
    <div className="admin-card-grid">{departments.map((department) => <DepartmentCard key={department.departmentId} department={department} onEdit={() => setDepartmentDialog({ department })} onDeactivate={() => setDeactivation(department)} runMutation={runMutation} />)}</div>

    {departmentDialog ? <AdminDialog title={departmentDialog.department ? 'Edit department' : 'Add department'} description={departmentDialog.department ? 'Update the department details used throughout Nexus.' : 'Create a department for routing and ticket ownership.'} wide onClose={() => setDepartmentDialog(null)}><DepartmentForm key={departmentDialog.department?.departmentId ?? 'new'} department={departmentDialog.department} runMutation={runMutation} onDone={() => setDepartmentDialog(null)} /></AdminDialog> : null}
    {deactivation ? <ConfirmDialog title="Deactivate department?" description={`${deactivation.name} will remain visible for historical records but will no longer accept new assignments.`} confirmLabel="Deactivate department" danger onConfirm={deactivate} onClose={() => setDeactivation(null)} /> : null}
  </div>
}

function DepartmentForm({ department, runMutation, onDone }) {
  const [form, setForm] = useState({ code: department?.code ?? '', name: department?.name ?? '', description: department?.desc ?? '' })
  function update(event) { setForm({ ...form, [event.target.name]: event.target.value }) }
  async function submit(event) {
    event.preventDefault()
    const action = department ? () => updateAdminDepartment(department.departmentId, form) : () => createAdminDepartment(form)
    const saved = await runMutation(action, department ? 'Department updated.' : 'Department created.')
    if (saved) onDone()
  }
  return <form className="admin-form" onSubmit={submit}><div className="admin-form-grid"><label className="field"><span>Code</span><input name="code" required value={form.code} onChange={update} /></label><label className="field"><span>Name</span><input name="name" required value={form.name} onChange={update} /></label><label className="field field-wide"><span>Description</span><textarea name="description" required value={form.description} onChange={update} /></label></div><div className="form-actions"><button type="submit" className="btn primary">Save department</button><button type="button" className="btn ghost" onClick={onDone}>Cancel</button></div></form>
}

function DepartmentCard({ department, onEdit, onDeactivate, runMutation }) {
  return <article className={`admin-card clay-card ${department.active ? '' : 'is-inactive'}`}><div className="admin-card-heading"><div><p className="eyebrow">{department.code}</p><h3 className="admin-card-title">{department.name}</h3></div><span className={`status-toggle ${department.active ? 'is-active' : ''}`}>{department.active ? 'Active' : 'Inactive'}</span></div><p>{department.desc}</p><p className="muted">{department._count?.members ?? 0} members · {department._count?.tickets ?? 0} tickets</p><div className="form-actions"><button type="button" className="btn ghost" onClick={onEdit}>Edit</button>{department.active ? <button type="button" className="btn danger" onClick={onDeactivate}>Deactivate</button> : <button type="button" className="btn primary" onClick={() => void runMutation(() => reactivateAdminDepartment(department.departmentId), 'Department reactivated.')}>Reactivate</button>}</div></article>
}

function ConfigurationsSection({ configurations, runMutation }) {
  return <div className="admin-card-grid">{configurations.map((configuration) => <ConfigurationCard key={configuration.key} configuration={configuration} runMutation={runMutation} />)}</div>
}

function ConfigurationCard({ configuration, runMutation }) {
  const [value, setValue] = useState(configuration.value)
  const title = configuration.key.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  return <article className="admin-card clay-card"><p className="eyebrow">Operational setting</p><h3 className="admin-card-title">{title}</h3><p>{configuration.description}</p><label className="field"><span>Minutes</span><input type="number" min="0" value={value} onChange={(event) => setValue(event.target.value)} /></label><button type="button" className="btn primary" onClick={() => void runMutation(() => updateAdminConfiguration(configuration.key, value), 'Configuration updated.')}>Save</button></article>
}

function AdminDialog({ title, description, children, onClose, wide = false }) {
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className={`dialog clay-card ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><div className="dialog-heading"><div><p className="eyebrow">Administration</p><h2>{title}</h2>{description ? <p>{description}</p> : null}</div><button type="button" className="dialog-close" aria-label="Close dialog" onClick={onClose}>×</button></div>{children}</section></div>
}

function ConfirmDialog({ title, description, confirmLabel, danger = false, onConfirm, onClose }) {
  const [submitting, setSubmitting] = useState(false)
  async function confirm() {
    setSubmitting(true)
    await onConfirm()
    setSubmitting(false)
  }
  return <AdminDialog title={title} description={description} onClose={onClose}><div className="dialog-actions"><button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>Cancel</button><button type="button" className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => void confirm()} disabled={submitting}>{submitting ? 'Saving...' : confirmLabel}</button></div></AdminDialog>
}
