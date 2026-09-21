import { Dialog } from '../../ui/Dialog/Dialog'

export function UserDetailsDialog({ user, error = '', loading = false, onClose }) {
  if (!user) return null

  const nameParts = (user.fullName || '').trim().split(/\s+/)
  const firstName = nameParts[0] || '—'
  const lastName = nameParts.slice(1).join(' ') || '—'
  const departments = user.departments ?? []

  return (
    <Dialog wide className="user-details-dialog" ariaLabel={`Details for ${user.fullName}`} onClose={onClose}>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">User profile</p>
            <h2>{user.fullName}</h2>
            <p>Account and access information.</p>
          </div>
          <button
            type="button"
            className="dialog-close"
            aria-label="Close user details"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {loading ? <p className="muted">Loading full profile…</p> : null}
        {error ? (
          <p className="mapping-notice">
            {error} Showing the information available here.
          </p>
        ) : null}
        <div className="user-details-grid">
          <ProfileField label="First name" value={firstName} />
          <ProfileField label="Last name" value={lastName} />
          <ProfileField label="Email" value={user.email || '—'} />
          <ProfileField label="Phone" value={user.phoneNumber || 'Not provided'} />
          <ProfileField label="Role" value={user.role || '—'} />
          <ProfileField
            label="Status"
            value={user.isActive === undefined ? '—' : user.isActive ? 'Active' : 'Inactive'}
          />
          <ProfileField
            label="Login"
            value={user.hasLogged === undefined ? '—' : user.hasLogged ? 'Logged in' : 'Not yet logged in'}
          />
          <div className="user-detail-field user-detail-field-wide">
            <span>Departments</span>
            {departments.length ? (
              <div className="user-department-list">
                {departments.map((department) => (
                  <span key={department.departmentId} className="user-department-chip">
                    {department.name} <small>{department.code}</small>
                  </span>
                ))}
              </div>
            ) : (
              <strong>None assigned</strong>
            )}
          </div>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
    </Dialog>
  )
}

function ProfileField({ label, value }) {
  return (
    <div className="user-detail-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

