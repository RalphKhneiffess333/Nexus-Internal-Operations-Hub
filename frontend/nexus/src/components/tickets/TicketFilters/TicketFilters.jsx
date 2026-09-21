import { TicketStatus } from '../../../features/tickets/ticket-types'
import { AppSelect } from '../../ui/AppSelect'
import { DebouncedSearchInput } from '../../ui/DebouncedSearchInput/DebouncedSearchInput'

const statusLabels = {
  [TicketStatus.OPEN]: 'Open',
  [TicketStatus.CLAIMED]: 'Claimed',
  [TicketStatus.CLOSED]: 'Closed',
  [TicketStatus.REOPENED]: 'Reopened',
}

export function TicketFilters({ departments, priorities = [], statuses = [], filters, onChange, showStatus = true }) {
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
          <AppSelect
            value={filters.status}
            onChange={(value) => onChange('status', value)}
            options={[
              { value: '', label: 'All statuses' },
              ...(statuses.length ? statuses : Object.keys(statusLabels)).map((status) => ({
                value: status,
                label: statusLabels[status] ?? status,
              })),
            ]}
          />
        </label>
      ) : null}
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
        <span>Priority</span>
        <AppSelect
          value={filters.priority}
          onChange={(value) => onChange('priority', value)}
          options={[
            { value: '', label: 'All priorities' },
            ...priorities.map((priority) => ({ value: priority.code, label: priority.name })),
          ]}
        />
      </label>
    </div>
  )
}
