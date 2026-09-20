import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserLink } from '../../../components/users/UserLink/UserLink'
import { LoadingState } from '../../../components/ui/LoadingState/LoadingState'
import { getDashboardSummary } from '../../../features/dashboard/dashboard-api'
import {
  formatDateTime,
  TicketStatus,
  UserRole,
} from '../../../features/tickets/ticket-types'
import { TicketStatusBadge } from '../../../components/tickets/TicketStatusBadge/TicketStatusBadge'
import { useAuthentication } from '../../../features/authentication/use-authentication'
import { usePriorities, priorityLabel } from '../../../features/priorities/use-priorities'
import { useLatestRequest } from '../../../lib/api/use-latest-request'
import dashboardStyles from '../DashboardPage.module.css'

const ACTIVITY_LABELS = {
  SUBMISSION: 'Ticket submitted',
  CLAIM: 'Ticket claimed',
  CLOSE: 'Ticket closed',
  REOPEN: 'Ticket reopened',
  DELETE: 'Ticket cancelled',
  MODIFICATION: 'Ticket updated',
  HANDOFF: 'Ticket handoff',
  USER_PREPROVISIONING: 'User pre-provisioned',
  ROLE_MAPPING: 'User role changed',
  USER_ACTIVATION: 'User activated',
  USER_DEACTIVATION: 'User deactivated',
  DEPARTMENT_ADDITION: 'Department added',
  DEPARTMENT_MODIFICATION: 'Department updated',
  DEPARTMENT_DELETION: 'Department deactivated',
  DEPARTMENT_REACTIVATION: 'Department reactivated',
  DEPARTMENT_MAPPING: 'Department membership changed',
  SYSTEM_VARIABLE_MODIFICATION: 'Configuration updated',
}

function firstName(fullName) {
  return fullName?.trim().split(/\s+/)[0] || 'there'
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function sumStatuses(counts, statuses) {
  return statuses.reduce((total, status) => total + (counts?.[status] ?? 0), 0)
}

export function DashboardPage() {
  const { user } = useAuthentication()
  const { priorities } = usePriorities()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { beginRequest } = useLatestRequest()

  const loadSummary = useCallback(async () => {
    const request = beginRequest()
    setLoading(true)
    setError('')
    try {
      const result = await getDashboardSummary({ signal: request.controller.signal })
      if (!request.isCurrent()) return
      setSummary(result)
    } catch (loadError) {
      if (!request.isCurrent()) return
      setError(loadError.message || 'Unable to load your dashboard.')
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [beginRequest])

  useEffect(() => {
    // The dashboard effect synchronizes this page with the authenticated API session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSummary()
  }, [loadSummary])

  const role = summary?.role ?? user?.role
  const isAdmin = role === UserRole.ADMIN
  const canWorkTickets = role === UserRole.AGENT || isAdmin
  const myTicketCounts = summary?.myTickets?.counts ?? {}
  const assignedCounts = summary?.work?.assigned?.counts ?? {}
  const poolCounts = summary?.work?.pool?.counts ?? {}
  const openPoolCount = sumStatuses(poolCounts, [TicketStatus.OPEN, TicketStatus.REOPENED])
  const activeWorkCount = assignedCounts[TicketStatus.CLAIMED] ?? 0

  const attentionTickets = useMemo(() => {
    return summary?.myTickets?.attention ?? []
  }, [summary])

  if (loading && !summary) return <LoadingState>Preparing your workspace...</LoadingState>

  return (
    <section className={`page dashboard-page ${dashboardStyles.moduleAnchor}`}>
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1>{greeting()}, {firstName(summary?.user?.fullName ?? user?.fullName)}</h1>
          <p className="page-description">
            {isAdmin
              ? 'A clear view of Nexus operations, your teams, and the work that needs attention.'
              : canWorkTickets
                ? 'Keep requests moving with a focused view of your queues and assigned work.'
                : 'Track your requests and get help from the right department.'}
          </p>
        </div>
        <div className="dashboard-hero-side">
          <span className="dashboard-role">{roleLabel(role)}</span>
          {summary?.departments?.length ? (
            <span className="dashboard-departments">
              {summary.departments.map((department) => department.code).join(' · ')}
            </span>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="banner error">
          <p>{error}</p>
          <button type="button" className="btn ghost" onClick={loadSummary}>Try again</button>
        </div>
      ) : null}

      <div className="dashboard-actions">
        <Link to="/tickets/new" className="btn primary">New ticket</Link>
        <Link to="/tickets" className="btn ghost">View my tickets</Link>
        {canWorkTickets ? <Link to="/tickets/pool" className="btn ghost">Open ticket pools</Link> : null}
        {canWorkTickets ? <Link to="/tickets/handoffs" className="btn ghost">Review handoffs</Link> : null}
        {isAdmin ? <Link to="/admin/management" className="btn ghost">Manage Nexus</Link> : null}
      </div>

      {isAdmin ? (
        <AdminOverview administration={summary?.administration} />
      ) : null}

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <p className="eyebrow">Personal overview</p>
            <h2>{canWorkTickets ? 'Your work at a glance' : 'Your requests at a glance'}</h2>
          </div>
          <Link to="/tickets" className="dashboard-section-link">See all tickets</Link>
        </div>
        <div className="dashboard-metric-grid">
          <MetricCard label="My requests" value={sumStatuses(myTicketCounts, Object.values(TicketStatus))} tone="blue" />
          <MetricCard label="Awaiting assignment" value={myTicketCounts[TicketStatus.OPEN] ?? 0} tone="mint" />
          {canWorkTickets ? (
            <MetricCard label="Assigned to me" value={activeWorkCount} tone="sky" />
          ) : (
            <MetricCard label="In progress" value={myTicketCounts[TicketStatus.CLAIMED] ?? 0} tone="sky" />
          )}
          <MetricCard label={canWorkTickets ? 'Tickets in my pools' : 'Resolved requests'} value={canWorkTickets ? openPoolCount : myTicketCounts[TicketStatus.CLOSED] ?? 0} tone="peach" />
        </div>
      </section>

      {canWorkTickets ? (
        <AgentWorkspace
          work={summary?.work}
          departments={summary?.departments ?? []}
        attentionTickets={attentionTickets}
        priorities={priorities}
        />
      ) : (
        <EmployeeWorkspace tickets={summary?.myTickets?.recent ?? []} attentionTickets={attentionTickets} priorities={priorities} />
      )}

      {isAdmin ? <AdminActivity activity={summary?.administration?.recentActivity ?? []} /> : null}
    </section>
  )
}

function roleLabel(role) {
  if (role === UserRole.ADMIN) return 'Administrator'
  if (role === UserRole.AGENT) return 'Department agent'
  return 'Employee'
}

function MetricCard({ label, value, tone }) {
  return (
    <article className={`dashboard-metric dashboard-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function EmployeeWorkspace({ tickets, attentionTickets, priorities }) {
  return (
    <section className="dashboard-section dashboard-content-grid">
      <div className="dashboard-panel clay-card">
        <div className="dashboard-panel-heading">
          <div><p className="eyebrow">Latest activity</p><h2>Recent requests</h2></div>
          <Link to="/tickets" className="dashboard-section-link">View all</Link>
        </div>
        <TicketPreviewList tickets={tickets} priorities={priorities} emptyTitle="No requests yet" emptyText="Submit a ticket when you need help from an internal department." />
      </div>
      <AttentionPanel tickets={attentionTickets} priorities={priorities} employee />
    </section>
  )
}

function AgentWorkspace({ work, departments, attentionTickets, priorities }) {
  const assignedTickets = work?.assigned?.recent ?? []
  const poolAttention = work?.pool?.attention ?? []
  const incoming = work?.handoffs?.incomingPending ?? 0
  const outgoing = work?.handoffs?.outgoingPending ?? 0

  return (
    <>
      <section className="dashboard-section dashboard-content-grid">
        <div className="dashboard-panel clay-card">
          <div className="dashboard-panel-heading">
            <div><p className="eyebrow">Active work</p><h2>Assigned to me</h2></div>
            <Link to="/tickets?view=claimed" className="dashboard-section-link">View all</Link>
          </div>
          <TicketPreviewList tickets={assignedTickets} priorities={priorities} emptyTitle="Your queue is clear" emptyText="Claim a request from one of your department pools to start working." />
        </div>
        <div className="dashboard-panel clay-card">
          <div className="dashboard-panel-heading">
            <div><p className="eyebrow">Available now</p><h2>Department pools</h2></div>
            <Link to="/tickets/pool" className="dashboard-section-link">Open pools</Link>
          </div>
          <div className="dashboard-department-list">
            {departments.map((department) => (
              <Link key={department.departmentId} to={`/tickets/pool?view=all&departmentId=${department.departmentId}`} className="dashboard-department-row">
                <span><strong>{department.name}</strong><small>{department.code}</small></span>
                <b>{department.unclaimedCount}</b>
              </Link>
            ))}
            {!departments.length ? <p className="dashboard-empty-note">You are not mapped to an active department yet.</p> : null}
          </div>
        </div>
      </section>

      <section className="dashboard-section dashboard-utility-grid">
        <QuickStatusCard label="Incoming handoffs" value={incoming} description="Requests waiting for your response" to="/tickets/handoffs" tone="purple" />
        <QuickStatusCard label="Outgoing handoffs" value={outgoing} description="Proposals still awaiting a response" to="/tickets/handoffs" tone="peach" />
        <AttentionPanel tickets={attentionTickets} ticketsFromPool={poolAttention} priorities={priorities} />
      </section>
    </>
  )
}

function AdminOverview({ administration }) {
  const users = administration?.users ?? {}
  const tickets = administration?.tickets ?? {}
  return (
    <section className="dashboard-section">
      <div className="dashboard-section-heading">
        <div><p className="eyebrow">Administration</p><h2>System overview</h2></div>
        <Link to="/admin/management" className="dashboard-section-link">Open management</Link>
      </div>
      <div className="dashboard-metric-grid dashboard-admin-metrics">
        <MetricCard label="Total users" value={users.total ?? 0} tone="blue" />
        <MetricCard label="Active users" value={users.active ?? 0} tone="mint" />
        <MetricCard label="Pending first login" value={users.pendingLogin ?? 0} tone="peach" />
        <MetricCard label="Active departments" value={administration?.activeDepartments ?? 0} tone="purple" />
        <MetricCard label="Open system tickets" value={tickets[TicketStatus.OPEN] ?? 0} tone="sky" />
        <MetricCard label="Reopened tickets" value={tickets[TicketStatus.REOPENED] ?? 0} tone="peach" />
      </div>
    </section>
  )
}

function AttentionPanel({ tickets, ticketsFromPool = [], employee = false, priorities = [] }) {
  const source = tickets.length ? tickets : ticketsFromPool
  return (
    <div className="dashboard-panel dashboard-attention clay-card">
      <div className="dashboard-panel-heading">
        <div><p className="eyebrow">Priority lane</p><h2>{employee ? 'Needs your attention' : 'Worth a look'}</h2></div>
      </div>
      {source.length ? (
        <div className="dashboard-attention-list">
          {source.map((ticket) => <DashboardTicketCard key={ticket.ticketId} ticket={ticket} priorities={priorities} compact />)}
        </div>
      ) : (
        <div className="dashboard-clear-state"><span aria-hidden="true">✓</span><p>{employee ? 'Nothing needs your attention right now.' : 'No priority items in your current queues.'}</p></div>
      )}
    </div>
  )
}

function QuickStatusCard({ label, value, description, to, tone }) {
  return <Link to={to} className={`dashboard-utility-card dashboard-utility-${tone}`}><span>{label}</span><strong>{value}</strong><small>{description}</small><b aria-hidden="true">→</b></Link>
}

function TicketPreviewList({ tickets, priorities = [], emptyTitle, emptyText }) {
  if (!tickets.length) {
    return <div className="dashboard-clear-state"><span aria-hidden="true">✓</span><div><strong>{emptyTitle}</strong><p>{emptyText}</p></div></div>
  }
  return <div className="dashboard-ticket-list">{tickets.map((ticket) => <DashboardTicketCard key={ticket.ticketId} ticket={ticket} priorities={priorities} />)}</div>
}

function DashboardTicketCard({ ticket, priorities = [], compact = false }) {
  return (
    <article className={`dashboard-ticket dashboard-ticket-${ticket.status?.toLowerCase() ?? 'unknown'} ${compact ? 'is-compact' : ''}`}>
      <Link className="dashboard-ticket-link" to={`/tickets/${ticket.ticketId}`} state={{ from: '/dashboard' }} aria-label={`View ticket ${ticket.title} ${ticket.ticketCode}`} />
      <div className="dashboard-ticket-content">
        <div className="dashboard-ticket-heading">
          <span className="ticket-code">{ticket.ticketCode}</span>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <h3>{ticket.title}</h3>
        {!compact ? (
          <div className="dashboard-ticket-meta">
            <span>{ticket.department?.name ?? 'Department'}</span>
            <span>{priorityLabel(ticket.priority, priorities)}</span>
            <span>{formatDateTime(ticket.updatedAt)}</span>
          </div>
        ) : null}
        <div className="dashboard-ticket-people">
          <span>Submitted by <UserLink user={ticket.submittedBy} /></span>
          {ticket.agent ? <span>Assigned to <UserLink user={ticket.agent} /></span> : null}
        </div>
      </div>
    </article>
  )
}

function AdminActivity({ activity }) {
  return (
    <section className="dashboard-section dashboard-panel clay-card">
      <div className="dashboard-panel-heading">
        <div><p className="eyebrow">History</p><h2>Recent system activity</h2></div>
        <Link to="/admin/logs" className="dashboard-section-link">Open logs</Link>
      </div>
      {activity.length ? (
        <div className="dashboard-activity-list">
          {activity.map((item, index) => (
            <div className="dashboard-activity-row" key={`${item.source}-${item.action}-${item.createdAt}-${index}`}>
              <span className={`dashboard-activity-dot ${item.source === 'ticket' ? 'is-ticket' : ''}`} aria-hidden="true" />
              <div><strong>{ACTIVITY_LABELS[item.action] ?? item.action}</strong><span>{item.actor?.fullName ?? 'System'}{item.ticket ? <> · <Link to={`/tickets/${item.ticket.ticketId}`}>{item.ticket.ticketCode}</Link></> : null}</span></div>
              <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
            </div>
          ))}
        </div>
      ) : <p className="dashboard-empty-note">System activity will appear here as Nexus is used.</p>}
    </section>
  )
}


