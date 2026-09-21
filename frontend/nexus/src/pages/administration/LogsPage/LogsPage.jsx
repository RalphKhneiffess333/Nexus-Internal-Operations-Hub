import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../../components/ui/LoadingState/LoadingState'
import { UserDetailsDialog } from '../../../components/users/UserDetailsDialog/UserDetailsDialog'
import {
  getAdminTicketEvent,
  getAdminActivity,
  getAuditLog,
} from '../../../features/administration/administration-api'
import { getUser } from '../../../features/users/users-api'
import { formatDateTime } from '../../../features/tickets/ticket-types'
import { useLatestRequest } from '../../../lib/api/use-latest-request'
import administrationStyles from '../../../components/administration/Administration.module.css'
import { AppSelect } from '../../../components/ui/AppSelect'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedSection = searchParams.get('section')
  const section = requestedSection === 'tickets' || requestedSection === 'audit' ? requestedSection : 'all'
  const action = searchParams.get('action') ?? ''
  const ticketAction = searchParams.get('ticketAction') ?? ''
  const parsedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const [entries, setEntries] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { beginRequest } = useLatestRequest()

  const loadLogs = useCallback(async () => {
    const request = beginRequest()
    setLoading(true)
    setError('')
    try {
      const result = await getAdminActivity(
        {
          page,
          pageSize: 25,
          source: section === 'all' ? 'all' : section === 'audit' ? 'audit' : 'ticket',
          auditAction: action,
          ticketAction,
        },
        { signal: request.controller.signal },
      )
      if (!request.isCurrent()) return
      setEntries(result?.items ?? [])
      setHasMore(Boolean(result?.hasMore))
    } catch (loadError) {
      if (!request.isCurrent()) return
      setError(loadError.message || 'Unable to load system history.')
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [action, beginRequest, page, section, ticketAction])

  useEffect(() => {
    // This effect owns the async history synchronization for the selected filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLogs()
  }, [loadLogs])

  function updateQuery(name, value) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('page')
    if (value) nextParams.set(name, value)
    else nextParams.delete(name)
    setSearchParams(nextParams)
  }

  function updateSection(nextSection) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('page')
    if (nextSection === 'all') nextParams.delete('section')
    else nextParams.set('section', nextSection)
    setSearchParams(nextParams)
  }

  function updatePage(nextPage) {
    const nextParams = new URLSearchParams(searchParams)
    if (nextPage > 1) nextParams.set('page', String(nextPage))
    else nextParams.delete('page')
    setSearchParams(nextParams)
  }

  return <section className={`page administration-page ${administrationStyles.moduleAnchor}`}><header className="page-header"><div><p className="eyebrow">History</p><h1>Logs</h1><p className="page-description">Read-only administrative and ticket-domain history.</p></div></header>{error ? <div className="banner error"><p>{error}</p><button type="button" className="btn ghost" onClick={loadLogs}>Try again</button></div> : null}<div className="pool-switcher" role="tablist" aria-label="Log sections">{logSections.map((item) => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? 'is-active' : ''} onClick={() => updateSection(item.id)}>{item.label}</button>)}</div><div className="log-filters">{section !== 'tickets' ? <label className="field admin-log-filter"><span>Audit action</span><AppSelect value={action} onChange={(value) => updateQuery('action', value)} options={[{ value: '', label: 'All audit actions' }, ...auditActions.map(([value, label]) => ({ value, label }))]} /></label> : null}{section !== 'audit' ? <label className="field admin-log-filter"><span>Ticket event</span><AppSelect value={ticketAction} onChange={(value) => updateQuery('ticketAction', value)} options={[{ value: '', label: 'All ticket events' }, ...ticketActions.map(([value, label]) => ({ value, label }))]} /></label> : null}</div>{loading ? <LoadingState>Loading history...</LoadingState> : null}{!loading && !error ? <div className="log-list">{entries.map((entry) => <LogEntry key={`${entry.source}-${entry.id}`} entry={entry} />)}{entries.length === 0 ? <div className="empty-state clay-card"><h2>No history found</h2><p>There are no events matching these filters.</p></div> : null}</div> : null}{!loading && !error && (page > 1 || hasMore) ? <div className="admin-pagination" aria-label="History pages"><button type="button" className="btn ghost" disabled={page === 1} onClick={() => updatePage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" className="btn ghost" disabled={!hasMore} onClick={() => updatePage(page + 1)}>Next</button></div> : null}</section>
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
  const { beginRequest: beginUserRequest } = useLatestRequest()
  const { beginRequest: beginDetailsRequest } = useLatestRequest()

  async function openUserDetails() {
    if (!entry.actor?.userId || userLoading) return
    const request = beginUserRequest()
    setUserLoading(true)
    setUserError('')
    try {
      const result = await getUser(entry.actor.userId, {
        signal: request.controller.signal,
      })
      if (!request.isCurrent()) return
      setUserDetails(result)
    } catch (loadError) {
      if (!request.isCurrent()) return
      setUserDetails(entry.actor)
      setUserError(loadError.message || 'Unable to load the complete user profile.')
    } finally {
      if (request.isCurrent()) setUserLoading(false)
    }
  }

  async function toggleDetails() {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    if (!nextExpanded || detailsLoaded || detailsLoading) return

    const request = beginDetailsRequest()
    setDetailsLoading(true)
    setDetailsError('')
    try {
      const result = entry.source === 'audit'
        ? await getAuditLog(entry.id, { signal: request.controller.signal })
        : await getAdminTicketEvent(entry.ticketId, entry.id, { signal: request.controller.signal })
      if (!request.isCurrent()) return
      setDetails(result?.details ?? null)
      setDetailsLoaded(true)
    } catch (loadError) {
      if (!request.isCurrent()) return
      setDetailsError(loadError.message || 'Unable to load event details.')
    } finally {
      if (request.isCurrent()) setDetailsLoading(false)
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



