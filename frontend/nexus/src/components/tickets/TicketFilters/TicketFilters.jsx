import { TicketStatus } from '../../../features/tickets/ticket-types'
import { DebouncedSearchInput } from '../../ui/DebouncedSearchInput/DebouncedSearchInput'

const statusLabels = {
  [TicketStatus.OPEN]: 'Open',
  [TicketStatus.CLAIMED]: 'Claimed',
  [TicketStatus.CLOSED]: 'Closed',
  [TicketStatus.REOPENED]: 'Reopened',
}

export function TicketFilters({ departments, priorities = [], filters, onChange, showStatus = true }) {
  return (
    <div className="ticket-filters" aria-label="Ticket filters">
      <label className="field ticket-filter ticket-search-filter">
        <span>Search tickets</span>
        <DebouncedSearchInput
          value={filters.search}
          onDebouncedChange={(value) => onChange('search', value)}
          placeholder="Number, title, or submitter"
          type="search"
        />
      </label>
      {showStatus ? (
        <label className="field ticket-filter">
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => onChange('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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
        <span>Priority</span>
        <select
          value={filters.priority}
          onChange={(event) => onChange('priority', event.target.value)}
        >
          <option value="">All priorities</option>
          {priorities.map((priority) => (
            <option key={priority.code} value={priority.code}>
              {priority.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

