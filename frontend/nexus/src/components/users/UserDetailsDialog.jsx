import { formatDateTime } from '../../features/tickets/ticket-types'

export function UserDetailsDialog({ user, error = '', onClose }) {
  const details = user

  if (!user) return null

  const nameParts = (details?.fullName || user.fullName || '').trim().split(/\s+/)
  const firstName = nameParts[0] || '—'
  const lastName = nameParts.slice(1).join(' ') || '—'
  const departments = details?.departments ?? []

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="dialog dialog-wide clay-card user-details-dialog" role="dialog" aria-modal="true" aria-label={`Details for ${details?.fullName || user.fullName}`} onMouseDown={(event) => event.stopPropagation()}><div className="dialog-heading"><div><p className="eyebrow">User profile</p><h2>{details?.fullName || user.fullName}</h2><p>Account and access information.</p></div><button type="button" className="dialog-close" aria-label="Close user details" onClick={onClose}>×</button></div>{error ? <p className="mapping-notice">{error} Showing the information available in the log.</p> : null}<div className="user-details-grid"><ProfileField label="First name" value={firstName} /><ProfileField label="Last name" value={lastName} /><ProfileField label="Email" value={details?.email || user.email || '—'} /><ProfileField label="Phone" value={details?.phoneNumber || 'Not provided'} /><ProfileField label="Role" value={details?.role || user.role || '—'} /><ProfileField label="Status" value={details?.isActive === undefined ? '—' : details.isActive ? 'Active' : 'Inactive'} /><ProfileField label="Login" value={details?.hasLogged === undefined ? '—' : details.hasLogged ? 'Logged in' : 'Not yet logged in'} /><div className="user-detail-field user-detail-field-wide"><span>Departments</span>{departments.length ? <div className="user-department-list">{departments.map((department) => <span key={department.departmentId} className="user-department-chip">{department.name} <small>{department.code}</small></span>)}</div> : <strong>None assigned</strong>}</div><ProfileField label="Created" value={details?.createdAt ? formatDateTime(details.createdAt) : '—'} /><ProfileField label="Last updated" value={details?.updatedAt ? formatDateTime(details.updatedAt) : '—'} /></div><div className="dialog-actions"><button type="button" className="btn ghost" onClick={onClose}>Close</button></div></section></div>
}

function ProfileField({ label, value }) {
  return <div className="user-detail-field"><span>{label}</span><strong>{value}</strong></div>
}
