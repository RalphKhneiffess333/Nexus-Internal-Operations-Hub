export const TicketStatus = {
  OPEN: 'OPEN',
  CLAIMED: 'CLAIMED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
}

export const TicketEventAction = {
  SUBMISSION: 'SUBMISSION',
  CLAIM: 'CLAIM',
  CLOSE: 'CLOSE',
  REOPEN: 'REOPEN',
  DELETE: 'DELETE',
  MODIFICATION: 'MODIFICATION',
  HANDOFF: 'HANDOFF',
}

export const HandoffStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
}

export const UserRole = {
  EMPLOYEE: 'Employee',
  AGENT: 'Agent',
  ADMIN: 'Admin',
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

export function formatDateTime(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function isOpenTicket(ticket) {
  return ticket?.status === TicketStatus.OPEN && ticket.active !== false
}

export function canWorkTickets(user) {
  return user?.role === UserRole.AGENT || user?.role === UserRole.ADMIN
}
