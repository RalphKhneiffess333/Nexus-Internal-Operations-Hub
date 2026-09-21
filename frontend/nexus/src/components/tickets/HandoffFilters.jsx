import { HandoffStatus } from '../../features/tickets/ticket-types'
import { AppSelect } from '../ui/AppSelect'
import { DebouncedSearchInput } from '../ui/DebouncedSearchInput'

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
        <DebouncedSearchInput
          value={searchInput}
          onDebouncedChange={onSearch}
          placeholder="Number or title"
          aria-label="Filter by ticket number or title"
          type="search"
        />
      </label>

      {view === 'outgoing' ? (
        <label className="field ticket-filter">
          <span>Requested to</span>
          <AppSelect
            value={filters.requestedAgentId}
            onChange={(value) => onChange('requestedAgentId', value)}
            options={[
              { value: '', label: 'Anyone' },
              ...users.map((user) => ({ value: user.userId, label: user.fullName })),
            ]}
          />
        </label>
      ) : (
        <label className="field ticket-filter">
          <span>Requested by</span>
          <AppSelect
            value={filters.requesterId}
            onChange={(value) => onChange('requesterId', value)}
            options={[
              { value: '', label: 'Anyone' },
              ...users.map((user) => ({ value: user.userId, label: user.fullName })),
            ]}
          />
        </label>
      )}

      <label className="field ticket-filter">
        <span>Department</span>
        <AppSelect
          value={filters.departmentId}
          onChange={(value) => onChange('departmentId', value)}
          options={[
            { value: '', label: 'All departments' },
            ...departments.map((department) => ({ value: department.departmentId, label: department.name })),
          ]}
        />
      </label>

      <label className="field ticket-filter">
        <span>Status</span>
        <AppSelect
          value={filters.status}
          onChange={(value) => onChange('status', value)}
          options={[
            { value: '', label: 'All statuses' },
            ...Object.entries(STATUS_LABELS).map(([optionValue, label]) => ({ value: optionValue, label })),
          ]}
        />
      </label>
      {hasFilters ? (
        <button type="button" className="btn ghost handoff-clear" onClick={onClear}>
          Clear filters
        </button>
      ) : null}
    </div>
  )
}
