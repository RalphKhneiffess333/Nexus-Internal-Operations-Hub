import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState } from '../../components/ui/LoadingState'
import { UserDetailsDialog } from '../../components/users/UserDetailsDialog'
import {
  getAdminTicketEvent,
  getAdminActivity,
  getAuditLog,
} from '../../features/administration/administration-api'
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
  const [entries, setEntries] = useState([])
  const [action, setAction] = useState('')
  const [ticketAction, setTicketAction] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getAdminActivity({
        page,
        pageSize: 25,
        source: section === 'all' ? 'all' : section === 'audit' ? 'audit' : 'ticket',
        auditAction: action,
        ticketAction,
      })
      setEntries(result?.items ?? [])
      setHasMore(Boolean(result?.hasMore))
    } catch (loadError) {
      setError(loadError.message || 'Unable to load system history.')
    } finally {
      setLoading(false)
    }
  }, [action, page, section, ticketAction])

  useEffect(() => {
    // This effect owns the async history synchronization for the selected filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLogs()
  }, [loadLogs])

  return <section className="page administration-page"><header className="page-header"><div><p className="eyebrow">History</p><h1>Logs</h1><p className="page-description">Read-only administrative and ticket-domain history.</p></div></header>{error ? <div className="banner error"><p>{error}</p><button type="button" className="btn ghost" onClick={loadLogs}>Try again</button></div> : null}<div className="pool-switcher" role="tablist" aria-label="Log sections">{logSections.map((item) => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? 'is-active' : ''} onClick={() => { setPage(1); setSection(item.id) }}>{item.label}</button>)}</div><div className="log-filters">{section !== 'tickets' ? <label className="field admin-log-filter"><span>Audit action</span><select value={action} onChange={(event) => { setPage(1); setAction(event.target.value) }}><option value="">All audit actions</option>{auditActions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}{section !== 'audit' ? <label className="field admin-log-filter"><span>Ticket event</span><select value={ticketAction} onChange={(event) => { setPage(1); setTicketAction(event.target.value) }}><option value="">All ticket events</option>{ticketActions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}</div>{loading ? <LoadingState>Loading history...</LoadingState> : null}{!loading && !error ? <div className="log-list">{entries.map((entry) => <LogEntry key={`${entry.source}-${entry.id}`} entry={entry} />)}{entries.length === 0 ? <div className="empty-state clay-card"><h2>No history found</h2><p>There are no events matching these filters.</p></div> : null}</div> : null}{!loading && !error && (page > 1 || hasMore) ? <div className="admin-pagination" aria-label="History pages"><button type="button" className="btn ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" className="btn ghost" disabled={!hasMore} onClick={() => setPage(page + 1)}>Next</button></div> : null}</section>
}

function LogEntry({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const [details, setDetails] = useState(undefined)
  const [detailsLoaded, setDetailsLoaded] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')
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

  async function toggleDetails() {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    if (!nextExpanded || detailsLoaded || detailsLoading) return

    setDetailsLoading(true)
    setDetailsError('')
    try {
      const result = entry.source === 'audit'
        ? await getAuditLog(entry.id)
        : await getAdminTicketEvent(entry.ticketId, entry.id)
      setDetails(result?.details ?? null)
      setDetailsLoaded(true)
    } catch (loadError) {
      setDetailsError(loadError.message || 'Unable to load event details.')
    } finally {
      setDetailsLoading(false)
    }
  }

  return <article className="log-entry clay-card"><div className="log-entry-row"><button type="button" className="log-entry-button" aria-expanded={expanded} onClick={() => void toggleDetails()}><span className="log-entry-source">{entry.source === 'audit' ? 'Audit log' : 'Ticket event'}</span><span className="log-entry-action">{formatLogAction(entry.action)}</span><span className="log-entry-actor">{entry.actor?.fullName || 'System'}</span><time>{formatDateTime(entry.createdAt)}</time></button><div className="log-entry-actions">{entry.ticketId ? <Link className="log-ticket-link" to={`/tickets/${entry.ticketId}`} state={{ from: '/admin/logs' }}>View ticket</Link> : null}{entry.actor ? <button type="button" className="log-user-link" onClick={() => void openUserDetails()} disabled={userLoading}>{userLoading ? 'Loading...' : 'View user'}</button> : null}</div></div>{expanded ? <LogDetails entry={{ ...entry, details }} loading={detailsLoading} loaded={detailsLoaded} error={detailsError} /> : null}{userDetails ? <UserDetailsDialog user={userDetails} error={userError} onClose={() => { setUserDetails(null); setUserError('') }} /> : null}</article>
}

function LogDetails({ entry, loading, loaded, error }) {
  if (loading) return <div className="log-entry-details"><p className="muted">Loading event details…</p></div>
  if (error) return <div className="log-entry-details"><p className="mapping-notice">{error}</p></div>
  if (!loaded) return <div className="log-entry-details"><p className="muted">Loading event details…</p></div>
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
