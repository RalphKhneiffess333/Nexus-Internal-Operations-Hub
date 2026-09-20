import { useState } from 'react'
import { DebouncedSearchInput } from '../ui/DebouncedSearchInput'
import { UserLink } from '../users/UserLink'
import { UserRole } from '../../features/tickets/ticket-types'
import { AdminConfirmDialog, AdminDialog } from './AdminDialog'

export function UsersSection({ model, actions, loading }) {
  const [pendingAction, setPendingAction] = useState(null)
  const [departmentUserId, setDepartmentUserId] = useState('')
  const departmentUser = model.items.find((user) => user.userId === departmentUserId) ?? null
  const filters = model.filters

  async function confirmPendingAction() {
    if (pendingAction.type === 'role') {
      await actions.updateUserRole(pendingAction.user.userId, pendingAction.role)
    } else {
      await actions.updateUserStatus(
        pendingAction.user.userId,
        !pendingAction.user.isActive,
      )
    }
    setPendingAction(null)
  }

  return (
    <div className="admin-section">
      <div className="admin-toolbar">
        <label className="field admin-search">
          <span>Search users</span>
          <DebouncedSearchInput
            value={filters.search}
            onDebouncedChange={(value) => actions.updateUserFilter('userSearch', value.trim())}
            placeholder="Name or email"
            aria-label="Search users"
            type="search"
          />
        </label>
        <div className="admin-filter-group">
          <label className="field admin-filter">
            <span>Status</span>
            <select value={filters.status} onChange={(event) => actions.updateUserFilter('userStatus', event.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="field admin-filter">
            <span>Department</span>
            <select value={filters.departmentId} onChange={(event) => actions.updateUserFilter('userDepartmentId', event.target.value)}>
              <option value="">All departments</option>
              {model.departments.map((department) => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}
            </select>
          </label>
          <label className="field admin-filter">
            <span>Login</span>
            <select value={filters.hasLogged} onChange={(event) => actions.updateUserFilter('userHasLogged', event.target.value)}>
              <option value="">Any login status</option>
              <option value="true">Has logged in</option>
              <option value="false">Has not logged in</option>
            </select>
          </label>
        </div>
        <button type="button" className="btn primary" onClick={() => actions.setShowCreateUser(true)}>Pre-provision user</button>
      </div>

      {model.showCreate ? (
        <AdminDialog
          title="Pre-provision a user"
          description="Create an account that will be linked to Microsoft Entra ID on first verified login."
          wide
          onClose={() => actions.setShowCreateUser(false)}
        >
          <CreateUserForm actions={actions} onDone={() => actions.setShowCreateUser(false)} />
        </AdminDialog>
      ) : null}

      <div className="admin-table-wrap clay-card">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Login</th><th>Departments</th></tr></thead>
          <tbody>
            {model.items.map((user) => (
              <UserRow
                key={user.userId}
                user={user}
                selected={model.selectedUserId === user.userId}
                onSelect={() => {
                  actions.selectUser(user.userId)
                  setDepartmentUserId(user.userId)
                }}
                onRequestAction={setPendingAction}
              />
            ))}
          </tbody>
        </table>
        {!loading && model.items.length === 0 ? <div className="empty-state"><h2>No users found</h2><p>Try a different search or pre-provision a user.</p></div> : null}
      </div>
      {model.total > 25 ? (
        <div className="admin-pagination" aria-label="User pages">
          <button type="button" className="btn ghost" disabled={model.page === 1} onClick={() => actions.updateUserPage(model.page - 1)}>Previous</button>
          <span>Page {model.page} of {Math.ceil(model.total / 25)}</span>
          <button type="button" className="btn ghost" disabled={model.page >= Math.ceil(model.total / 25)} onClick={() => actions.updateUserPage(model.page + 1)}>Next</button>
        </div>
      ) : null}

      {departmentUser ? (
        <AdminDialog title="Department mapping" description={`${departmentUser.fullName} · ${departmentUser.role}`} wide onClose={() => setDepartmentUserId('')}>
          <UserDepartmentEditor user={departmentUser} departments={model.departments} actions={actions} />
        </AdminDialog>
      ) : null}

      {pendingAction ? (
        <AdminConfirmDialog
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

  return (
    <tr
      className={selected ? 'is-selected' : ''}
      tabIndex={0}
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <td><UserLink user={user} /><span className="admin-subtext">{user.email}</span></td>
      <td>
        <select aria-label={`Role for ${user.fullName}`} value={user.role} onChange={changeRole} onClick={(event) => event.stopPropagation()}>
          <option value={UserRole.EMPLOYEE}>Employee</option>
          <option value={UserRole.AGENT}>Agent</option>
          <option value={UserRole.ADMIN}>Admin</option>
        </select>
      </td>
      <td>
        <button type="button" className={`status-toggle ${user.isActive ? 'is-active' : ''}`} onClick={(event) => { event.stopPropagation(); onRequestAction({ type: 'status', user }) }}>
          {user.isActive ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td>{user.hasLogged ? 'Logged in' : 'Not yet'}</td>
      <td>{user.departments?.length ? user.departments.map((department) => department.code).join(', ') : '—'}</td>
    </tr>
  )
}

function CreateUserForm({ actions, onDone }) {
  const [form, setForm] = useState({ email: '', fullName: '', phoneNumber: '', role: UserRole.EMPLOYEE })

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    const saved = await actions.createUser(form)
    if (saved) onDone()
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-grid">
        <label className="field"><span>Full name</span><input name="fullName" required value={form.fullName} onChange={update} /></label>
        <label className="field"><span>Email</span><input name="email" type="email" required value={form.email} onChange={update} /></label>
        <label className="field"><span>Phone</span><input name="phoneNumber" value={form.phoneNumber} onChange={update} /></label>
        <label className="field"><span>Initial role</span><select name="role" value={form.role} onChange={update}><option value={UserRole.EMPLOYEE}>Employee</option><option value={UserRole.AGENT}>Agent</option><option value={UserRole.ADMIN}>Admin</option></select></label>
      </div>
      <div className="form-actions"><button type="submit" className="btn primary">Create account</button><button type="button" className="btn ghost" onClick={onDone}>Cancel</button></div>
    </form>
  )
}

function UserDepartmentEditor({ user, departments, actions }) {
  const cannotMap = user.role === UserRole.EMPLOYEE

  return (
    <div className="admin-detail">
      <div>
        <p className="eyebrow">Department membership</p>
        {cannotMap ? <div className="mapping-notice"><strong>Department mapping unavailable</strong><p>Employees cannot be assigned to departments. Change this user to an agent or administrator first.</p></div> : <p className="muted">Select the departments this {user.role.toLowerCase()} can work in.</p>}
      </div>
      {!cannotMap && departments.length ? (
        <div className="membership-grid">
          {departments.map((department) => {
            const member = user.departments?.some((item) => item.departmentId === department.departmentId)
            const disabled = !department.active && !member
            return (
              <label key={department.departmentId} className={`membership-option ${member ? 'is-member' : ''} ${disabled ? 'is-disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={member}
                  disabled={disabled}
                  onChange={() => actions.updateUserDepartment(user.userId, department.departmentId, member, department.name)}
                />
                <span>{department.name}<small>{department.active ? department.code : member ? 'Inactive · assigned' : 'Inactive · unavailable'}</small></span>
              </label>
            )
          })}
        </div>
      ) : null}
      {!cannotMap && !departments.length ? <p className="mapping-notice">No departments are available for mapping.</p> : null}
    </div>
  )
}
