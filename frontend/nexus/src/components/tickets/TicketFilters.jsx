import { useEffect, useRef } from 'react'
import { TicketPriority, TicketStatus } from '../../features/tickets/ticket-types'

const statusLabels = {
  [TicketStatus.OPEN]: 'Open',
  [TicketStatus.CLAIMED]: 'Claimed',
  [TicketStatus.CLOSED]: 'Closed',
  [TicketStatus.REOPENED]: 'Reopened',
}

const priorityLabels = {
  [TicketPriority.LOW]: 'Low',
  [TicketPriority.MODERATE]: 'Moderate',
  [TicketPriority.HIGH]: 'High',
}

export function TicketFilters({ departments, filters, onChange, showStatus = true }) {
  const searchInputRef = useRef(null)
  const searchDebounceRef = useRef(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (searchInputRef.current && searchInputRef.current.value !== filters.search) {
      searchInputRef.current.value = filters.search
    }
  }, [filters.search])

  useEffect(() => () => {
    if (searchDebounceRef.current !== null) {
      window.clearTimeout(searchDebounceRef.current)
    }
  }, [])

  function handleSearchChange(event) {
    const value = event.target.value
    if (searchDebounceRef.current !== null) {
      window.clearTimeout(searchDebounceRef.current)
    }
    searchDebounceRef.current = window.setTimeout(() => {
      onChangeRef.current('search', value)
      searchDebounceRef.current = null
    }, 350)
  }

  return (
    <div className="ticket-filters" aria-label="Ticket filters">
      <label className="field ticket-filter ticket-search-filter">
        <span>Search tickets</span>
        <input
          ref={searchInputRef}
          defaultValue={filters.search}
          onChange={handleSearchChange}
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
          {Object.entries(priorityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
