import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../components/ui/LoadingState'
import { DebouncedSearchInput } from '../../components/ui/DebouncedSearchInput'
import { UserLink } from '../../components/users/UserLink'
import { UserRole } from '../../features/tickets/ticket-types'
import {
  addUserDepartment,
  createAdminDepartment,
  createAdminPriority,
  createAdminUser,
  deactivateAdminDepartment,
  getAdminDepartments,
  getAdminPriorities,
  getAdminUsers,
  deactivateAdminPriority,
  reactivateAdminPriority,
  reactivateAdminDepartment,
  removeUserDepartment,
  updateAdminDepartment,
  updateAdminPriority,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '../../features/administration/administration-api'

const sections = [
  { id: 'users', label: 'Users' },
  { id: 'departments', label: 'Departments' },
  { id: 'priorities', label: 'Priorities' },
]

function messageFor(error, fallback) {
  return error?.message || fallback
}

export function ManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedSection = searchParams.get('section')
  const section = sections.some((item) => item.id === requestedSection) ? requestedSection : 'users'
  const userSearch = searchParams.get('userSearch') ?? ''
  const userStatus = searchParams.get('userStatus') ?? ''
  const userDepartmentId = searchParams.get('userDepartmentId') ?? ''
  const userHasLogged = searchParams.get('userHasLogged') ?? ''
  const parsedUserPage = Number(searchParams.get('userPage') ?? '1')
  const userPage = Number.isInteger(parsedUserPage) && parsedUserPage > 0 ? parsedUserPage : 1
  const departmentSearch = searchParams.get('departmentSearch') ?? ''
  const parsedDepartmentPage = Number(searchParams.get('departmentPage') ?? '1')
  const departmentPage = Number.isInteger(parsedDepartmentPage) && parsedDepartmentPage > 0 ? parsedDepartmentPage : 1
  const [users, setUsers] = useState([])
  const [userTotal, setUserTotal] = useState(0)
  const [departments, setDepartments] = useState([])
  const departmentOptionsLoaded = useRef(false)
  const [departmentTotal, setDepartmentTotal] = useState(0)
  const [departmentOptions, setDepartmentOptions] = useState([])
  const [priorities, setPriorities] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (section === 'users') {
        const [userResult, departmentResult] = await Promise.all([
          getAdminUsers({ page: userPage, pageSize: 25, search: userSearch, status: userStatus, departmentId: userDepartmentId, hasLogged: userHasLogged }),
          departmentOptionsLoaded.current
            ? Promise.resolve(null)
            : getAdminDepartments({ page: 1, pageSize: 100 }),
        ])
        setUsers(userResult?.items ?? [])
        setUserTotal(userResult?.total ?? 0)
        if (departmentResult) {
          setDepartmentOptions(departmentResult.items ?? [])
          departmentOptionsLoaded.current = true
        }
      } else if (section === 'departments') {
        const departmentResult = await getAdminDepartments({ page: departmentPage, pageSize: 25, search: departmentSearch })
        setDepartments(departmentResult?.items ?? [])
        setDepartmentTotal(departmentResult?.total ?? 0)
      } else {
        const priorityResult = await getAdminPriorities()
        setPriorities(priorityResult ?? [])
      }
    } catch (loadError) {
      setError(messageFor(loadError, 'Unable to load management data.'))
    } finally {
      setLoading(false)
    }
  }, [departmentPage, departmentSearch, section, userDepartmentId, userHasLogged, userPage, userSearch, userStatus])

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
      departmentOptionsLoaded.current = false
      await loadData()
      return true
    } catch (mutationError) {
      setError(messageFor(mutationError, 'The change could not be saved.'))
      return false
    }
  }

  function updateSection(nextSection) {
    const nextParams = new URLSearchParams(searchParams)
    if (nextSection === 'users') nextParams.delete('section')
    else nextParams.set('section', nextSection)
    if (nextSection === 'users') nextParams.delete('userPage')
    if (nextSection === 'departments') nextParams.delete('departmentPage')
    setSearchParams(nextParams)
  }

  function updateUserFilter(name, value) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('userPage')
    if (value) nextParams.set(name, value)
    else nextParams.delete(name)
    setSearchParams(nextParams, name === 'userSearch' ? { replace: true } : undefined)
  }

  function updateDepartmentFilter(name, value) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('departmentPage')
    if (value) nextParams.set(name, value)
    else nextParams.delete(name)
    setSearchParams(nextParams, name === 'departmentSearch' ? { replace: true } : undefined)
  }

  function updateUserPage(nextPage) {
    const nextParams = new URLSearchParams(searchParams)
    if (nextPage > 1) nextParams.set('userPage', String(nextPage))
    else nextParams.delete('userPage')
    setSearchParams(nextParams)
  }

  function updateDepartmentPage(nextPage) {
    const nextParams = new URLSearchParams(searchParams)
    if (nextPage > 1) nextParams.set('departmentPage', String(nextPage))
    else nextParams.delete('departmentPage')
    setSearchParams(nextParams)
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
          <button key={item.id} type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? 'is-active' : ''} onClick={() => updateSection(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingState>Loading management data...</LoadingState> : null}
      {section === 'users' ? <UsersSection users={users} loading={loading} userPage={userPage} userTotal={userTotal} onUserPage={updateUserPage} departments={departmentOptions} selectedUserId={selectedUserId} search={userSearch} onSearch={(value) => updateUserFilter('userSearch', value.trim())} userStatus={userStatus} onUserStatus={(value) => updateUserFilter('userStatus', value)} userDepartmentId={userDepartmentId} onUserDepartment={(value) => updateUserFilter('userDepartmentId', value)} userHasLogged={userHasLogged} onUserHasLogged={(value) => updateUserFilter('userHasLogged', value)} onSelect={setSelectedUserId} showCreate={showCreateUser} setShowCreate={setShowCreateUser} runMutation={runMutation} /> : null}
      {section === 'departments' ? <DepartmentsSection departments={departments} loading={loading} search={departmentSearch} onSearch={(value) => updateDepartmentFilter('departmentSearch', value.trim())} departmentPage={departmentPage} departmentTotal={departmentTotal} onDepartmentPage={updateDepartmentPage} runMutation={runMutation} /> : null}
      {section === 'priorities' ? <PrioritiesSection priorities={priorities} runMutation={runMutation} /> : null}
    </section>
  )
}

function UsersSection({ users, loading, userPage, userTotal, onUserPage, departments, selectedUserId, search, onSearch, userStatus, onUserStatus, userDepartmentId, onUserDepartment, userHasLogged, onUserHasLogged, onSelect, showCreate, setShowCreate, runMutation }) {
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
          <DebouncedSearchInput value={search} onDebouncedChange={onSearch} placeholder="Name or email" aria-label="Search users" type="search" />
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
        {!loading && users.length === 0 ? <div className="empty-state"><h2>No users found</h2><p>Try a different search or pre-provision a user.</p></div> : null}
      </div>
      {userTotal > 25 ? <div className="admin-pagination" aria-label="User pages"><button type="button" className="btn ghost" disabled={userPage === 1} onClick={() => onUserPage(userPage - 1)}>Previous</button><span>Page {userPage} of {Math.ceil(userTotal / 25)}</span><button type="button" className="btn ghost" disabled={userPage >= Math.ceil(userTotal / 25)} onClick={() => onUserPage(userPage + 1)}>Next</button></div> : null}
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

function DepartmentsSection({ departments, loading, search, onSearch, departmentPage, departmentTotal, onDepartmentPage, runMutation }) {
  const [departmentDialog, setDepartmentDialog] = useState(null)
  const [deactivation, setDeactivation] = useState(null)

  async function deactivate() {
    await runMutation(() => deactivateAdminDepartment(deactivation.departmentId), 'Department deactivated.')
    setDeactivation(null)
  }

  return <div className="admin-section">
    <div className="admin-toolbar"><label className="field admin-search"><span>Search departments</span><DebouncedSearchInput value={search} onDebouncedChange={onSearch} placeholder="Code or name" aria-label="Search departments" type="search" /></label><div><p className="muted">Inactive departments remain visible for historical records.</p></div><button type="button" className="btn primary" onClick={() => setDepartmentDialog({ department: null })}>Add department</button></div>
    <div className="admin-card-grid">{departments.map((department) => <DepartmentCard key={department.departmentId} department={department} onEdit={() => setDepartmentDialog({ department })} onDeactivate={() => setDeactivation(department)} runMutation={runMutation} />)}</div>
    {!loading && departments.length === 0 ? <div className="empty-state"><h2>No departments found</h2><p>Try a different search or add a department.</p></div> : null}
    {!loading && departmentTotal > 25 ? <div className="admin-pagination" aria-label="Department pages"><button type="button" className="btn ghost" disabled={departmentPage === 1} onClick={() => onDepartmentPage(departmentPage - 1)}>Previous</button><span>Page {departmentPage} of {Math.ceil(departmentTotal / 25)}</span><button type="button" className="btn ghost" disabled={departmentPage >= Math.ceil(departmentTotal / 25)} onClick={() => onDepartmentPage(departmentPage + 1)}>Next</button></div> : null}

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

function PrioritiesSection({ priorities, runMutation }) {
  const [priorityDialog, setPriorityDialog] = useState(null)
  const [deactivation, setDeactivation] = useState(null)

  async function deactivate() {
    await runMutation(() => deactivateAdminPriority(deactivation.priorityId), 'Priority deactivated.')
    setDeactivation(null)
  }

  return <div className="admin-section">
    <div className="admin-toolbar"><div><p className="muted">Priorities control ticket routing labels and unclaimed-ticket reminder intervals.</p></div><button type="button" className="btn primary" onClick={() => setPriorityDialog({ priority: null })}>Add priority</button></div>
    <div className="admin-card-grid">{priorities.map((priority) => <article key={priority.priorityId} className={`admin-card clay-card ${priority.active ? '' : 'is-inactive'}`}><div className="admin-card-heading"><div><p className="eyebrow">{priority.code}</p><h3 className="admin-card-title">{priority.name}</h3></div><span className={`status-toggle ${priority.active ? 'is-active' : ''}`}>{priority.active ? 'Active' : 'Inactive'}</span></div><p>Reminders every {priority.reminderIntervalMinutes} minutes.</p><div className="form-actions"><button type="button" className="btn ghost" onClick={() => setPriorityDialog({ priority })}>Edit</button>{priority.active ? <button type="button" className="btn danger" onClick={() => setDeactivation(priority)}>Deactivate</button> : <button type="button" className="btn primary" onClick={() => void runMutation(() => reactivateAdminPriority(priority.priorityId), 'Priority reactivated.')}>Reactivate</button>}</div></article>)}</div>
    {!priorities.length ? <div className="empty-state"><h2>No priorities found</h2><p>Add a priority to make it available for new tickets.</p></div> : null}
    {priorityDialog ? <AdminDialog title={priorityDialog.priority ? 'Edit priority' : 'Add priority'} description="Set the label and reminder interval used by tickets with this priority." onClose={() => setPriorityDialog(null)}><PriorityForm key={priorityDialog.priority?.priorityId ?? 'new'} priority={priorityDialog.priority} runMutation={runMutation} onDone={() => setPriorityDialog(null)} /></AdminDialog> : null}
    {deactivation ? <ConfirmDialog title="Deactivate priority?" description={`${deactivation.name} will remain visible for historical tickets but cannot be selected for new or updated tickets.`} confirmLabel="Deactivate priority" danger onConfirm={deactivate} onClose={() => setDeactivation(null)} /> : null}
  </div>
}

function PriorityForm({ priority, runMutation, onDone }) {
  const [form, setForm] = useState({ code: priority?.code ?? '', name: priority?.name ?? '', reminderIntervalMinutes: priority?.reminderIntervalMinutes ?? 240 })
  function update(event) { setForm({ ...form, [event.target.name]: event.target.value }) }
  async function submit(event) {
    event.preventDefault()
    const payload = { ...form, reminderIntervalMinutes: Number(form.reminderIntervalMinutes) }
    const action = priority ? () => updateAdminPriority(priority.priorityId, { name: payload.name, reminderIntervalMinutes: payload.reminderIntervalMinutes }) : () => createAdminPriority(payload)
    const saved = await runMutation(action, priority ? 'Priority updated.' : 'Priority created.')
    if (saved) onDone()
  }
  return <form className="admin-form" onSubmit={submit}><div className="admin-form-grid"><label className="field"><span>Code</span><input name="code" required disabled={Boolean(priority)} value={form.code} onChange={update} /></label><label className="field"><span>Name</span><input name="name" required value={form.name} onChange={update} /></label><label className="field"><span>Reminder interval (minutes)</span><input name="reminderIntervalMinutes" type="number" min="0" required value={form.reminderIntervalMinutes} onChange={update} /></label></div><div className="form-actions"><button type="submit" className="btn primary">Save priority</button><button type="button" className="btn ghost" onClick={onDone}>Cancel</button></div></form>
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
