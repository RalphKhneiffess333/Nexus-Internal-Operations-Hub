import { HandoffStatus } from '../../features/tickets/ticket-types'

const STATUS_LABELS = {
  [HandoffStatus.PENDING]: 'Pending',
  [HandoffStatus.ACCEPTED]: 'Accepted',
  [HandoffStatus.REJECTED]: 'Rejected',
  [HandoffStatus.CANCELLED]: 'Cancelled',
}

export function HandoffFilters({
  departments = [],
  users = [],
  filters,
  view,
  searchInput,
  onSearch,
  onChange,
  onClear,
}) {
  const hasFilters = Boolean(
    searchInput ||
      filters.requestedAgentId ||
      filters.requesterId ||
      filters.departmentId ||
      filters.status,
  )

  return (
    <div className="ticket-filters handoff-filters" aria-label="Handoff filters">
      <label className="field ticket-filter ticket-search-filter">
        <span>Ticket</span>
        <input
          value={searchInput}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Number or title"
          aria-label="Filter by ticket number or title"
        />
      </label>

      {view === 'outgoing' ? (
        <label className="field ticket-filter">
          <span>Requested to</span>
          <select
            value={filters.requestedAgentId}
            onChange={(event) => onChange('requestedAgentId', event.target.value)}
          >
            <option value="">Anyone</option>
            {users.map((user) => (
              <option key={user.userId} value={user.userId}>
                {user.fullName}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="field ticket-filter">
          <span>Requested by</span>
          <select
            value={filters.requesterId}
            onChange={(event) => onChange('requesterId', event.target.value)}
          >
            <option value="">Anyone</option>
            {users.map((user) => (
              <option key={user.userId} value={user.userId}>
                {user.fullName}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field ticket-filter">
        <span>Department</span>
        <select
          value={filters.departmentId}
          onChange={(event) => onChange('departmentId', event.target.value)}
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.departmentId} value={department.departmentId}>
              {department.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field ticket-filter">
        <span>Status</span>
        <select
          value={filters.status}
          onChange={(event) => onChange('status', event.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {hasFilters ? (
        <button type="button" className="btn ghost handoff-clear" onClick={onClear}>
          Clear filters
        </button>
      ) : null}
    </div>
  )
}
