import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState } from '../../components/ui/LoadingState'
import { UserDetailsDialog } from '../../components/users/UserDetailsDialog'
import { getAdminTicketEvents, getAuditLogs } from '../../features/administration/administration-api'
import { getUser } from '../../features/users/users-api'
import { formatDateTime } from '../../features/tickets/ticket-types'

const logSections = [
  { id: 'all', label: 'All system events' },
  { id: 'tickets', label: 'Ticket events' },
  { id: 'audit', label: 'Audit logs' },
]

const auditActions = [
  ['USER_PREPROVISIONING', 'User pre-provisioning'],
  ['ROLE_MAPPING', 'Role mapping'],
  ['USER_ACTIVATION', 'User activation'],
  ['USER_DEACTIVATION', 'User deactivation'],
  ['DEPARTMENT_ADDITION', 'Department addition'],
  ['DEPARTMENT_MODIFICATION', 'Department modification'],
  ['DEPARTMENT_DELETION', 'Department deletion'],
  ['DEPARTMENT_MAPPING', 'Department mapping'],
  ['SYSTEM_VARIABLE_MODIFICATION', 'Configuration modification'],
]

const ticketActions = [
  ['SUBMISSION', 'Submission'],
  ['CLAIM', 'Claim'],
  ['CLOSE', 'Close'],
  ['REOPEN', 'Reopen'],
  ['DELETE', 'Delete'],
  ['MODIFICATION', 'Modification'],
  ['HANDOFF', 'Handoff'],
]

export function LogsPage() {
  const [section, setSection] = useState('all')
  const [auditLogs, setAuditLogs] = useState([])
  const [ticketEvents, setTicketEvents] = useState([])
  const [action, setAction] = useState('')
  const [ticketAction, setTicketAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [auditResult, ticketResult] = await Promise.all([
        getAuditLogs({ page: 1, pageSize: 100, action }),
        getAdminTicketEvents({ page: 1, pageSize: 100, action: ticketAction }),
      ])
      setAuditLogs(auditResult?.items ?? [])
      setTicketEvents(ticketResult ?? [])
    } catch (loadError) {
      setError(loadError.message || 'Unable to load system history.')
    } finally {
      setLoading(false)
    }
  }, [action, ticketAction])

  useEffect(() => {
    // This effect owns the async history synchronization for the selected filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLogs()
  }, [loadLogs])

  const entries = useMemo(() => {
    const audit = auditLogs.map((log) => ({ id: log.auditLogId, source: 'Audit log', action: log.action, createdAt: log.createdAt, actor: log.actor, details: log.details }))
    const tickets = ticketEvents.map((event) => ({ id: event.ticketEventId, source: 'Ticket event', action: event.action, createdAt: event.createdAt, actor: event.user, ticketId: event.ticketId, details: event.details }))
    if (section === 'audit') return audit
    if (section === 'tickets') return tickets
    return [...audit, ...tickets].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
  }, [auditLogs, ticketEvents, section])

  return <section className="page administration-page"><header className="page-header"><div><p className="eyebrow">History</p><h1>Logs</h1><p className="page-description">Read-only administrative and ticket-domain history.</p></div></header>{error ? <div className="banner error"><p>{error}</p><button type="button" className="btn ghost" onClick={loadLogs}>Try again</button></div> : null}<div className="pool-switcher" role="tablist" aria-label="Log sections">{logSections.map((item) => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? 'is-active' : ''} onClick={() => setSection(item.id)}>{item.label}</button>)}</div><div className="log-filters">{section !== 'tickets' ? <label className="field admin-log-filter"><span>Audit action</span><select value={action} onChange={(event) => setAction(event.target.value)}><option value="">All audit actions</option>{auditActions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}{section !== 'audit' ? <label className="field admin-log-filter"><span>Ticket event</span><select value={ticketAction} onChange={(event) => setTicketAction(event.target.value)}><option value="">All ticket events</option>{ticketActions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}</div>{loading ? <LoadingState>Loading history...</LoadingState> : null}{!loading && !error ? <div className="log-list">{entries.map((entry) => <LogEntry key={`${entry.source}-${entry.id}`} entry={entry} />)}{entries.length === 0 ? <div className="empty-state clay-card"><h2>No history found</h2><p>There are no events matching these filters.</p></div> : null}</div> : null}</section>
}

function LogEntry({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const [userDetails, setUserDetails] = useState(null)
  const [userLoading, setUserLoading] = useState(false)
  const [userError, setUserError] = useState('')

  async function openUserDetails() {
    if (!entry.actor?.userId || userLoading) return
    setUserLoading(true)
    setUserError('')
    try {
      setUserDetails(await getUser(entry.actor.userId))
    } catch (loadError) {
      setUserDetails(entry.actor)
      setUserError(loadError.message || 'Unable to load the complete user profile.')
    } finally {
      setUserLoading(false)
    }
  }

  return <article className="log-entry clay-card"><div className="log-entry-row"><button type="button" className="log-entry-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><span className="log-entry-source">{entry.source}</span><span className="log-entry-action">{formatLogAction(entry.action)}</span><span className="log-entry-actor">{entry.actor?.fullName || 'System'}</span><time>{formatDateTime(entry.createdAt)}</time></button><div className="log-entry-actions">{entry.ticketId ? <Link className="log-ticket-link" to={`/tickets/${entry.ticketId}`} state={{ from: '/admin/logs' }}>View ticket</Link> : null}{entry.actor ? <button type="button" className="log-user-link" onClick={() => void openUserDetails()} disabled={userLoading}>{userLoading ? 'Loading...' : 'View user'}</button> : null}</div></div>{expanded ? <LogDetails entry={entry} /> : null}{userDetails ? <UserDetailsDialog user={userDetails} error={userError} onClose={() => { setUserDetails(null); setUserError('') }} /> : null}</article>
}

function LogDetails({ entry }) {
  const details = entry.details && typeof entry.details === 'object' ? Object.entries(entry.details).filter(([key]) => !isTechnicalIdentifier(key)) : []
  return <div className="log-entry-details"><div className="log-details-heading"><span>Event details</span><span>{formatLogAction(entry.action)}</span></div>{details.length ? <dl className="log-detail-list">{details.map(([key, value]) => <div className="log-detail-row" key={key}><dt>{humanizeKey(key)}</dt><dd><DetailValue value={value} /></dd></div>)}</dl> : <p className="muted">No additional details were recorded for this event.</p>}</div>
}

function DetailValue({ value }) {
  if (value === null || value === undefined || value === '') return <span className="log-detail-empty">—</span>
  if (Array.isArray(value)) return <ul className="log-detail-list nested">{value.map((item, index) => <li key={`${index}-${String(item)}`}><DetailValue value={item} /></li>)}</ul>
  if (typeof value === 'object') return <dl className="log-detail-list nested">{Object.entries(value).filter(([key]) => !isTechnicalIdentifier(key)).map(([key, nestedValue]) => <div className="log-detail-row" key={key}><dt>{humanizeKey(key)}</dt><dd><DetailValue value={nestedValue} /></dd></div>)}</dl>
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>
  return <span>{formatReadableValue(String(value))}</span>
}

function formatLogAction(action) {
  return titleCase(action || 'Event')
}

function formatReadableValue(value) {
  if (/^[A-Z0-9_ -]+$/.test(value) && value === value.toUpperCase()) return titleCase(value)
  return value
}

function humanizeKey(key) {
  return titleCase(key.replace(/([a-z])([A-Z])/g, '$1_$2'))
}

function isTechnicalIdentifier(key) {
  return key === 'id' || key.endsWith('Id') || key.endsWith('_id')
}

function titleCase(value) {
  return value.toLowerCase().split(/[_ -]+/).map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : word).join(' ')
}
