export const TicketStatus = {
  OPEN: 'OPEN',
  CLAIMED: 'CLAIMED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
}

export const TicketPriority = {
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
}

export const DEPARTMENTS = [
  { id: 'dept-it', label: 'IT' },
  { id: 'dept-hr', label: 'HR' },
]

export const CURRENT_USER_ID =
  import.meta.env.VITE_SUBMITTED_BY || 'user-employee-1'

export function departmentLabel(departmentId) {
  return DEPARTMENTS.find((department) => department.id === departmentId)?.label
    ?? departmentId
}

export function formatDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function isOpenTicket(ticket) {
  return ticket?.status === TicketStatus.OPEN && ticket.active !== false
}
