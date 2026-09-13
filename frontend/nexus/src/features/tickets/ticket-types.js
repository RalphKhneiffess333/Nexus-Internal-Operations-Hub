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
