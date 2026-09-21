export function formatTicketPageTitle(ticket, fallbackTitle) {
  const title = typeof ticket?.title === 'string' ? ticket.title.trim() : ''
  const ticketCode = typeof ticket?.ticketCode === 'string' ? ticket.ticketCode.trim() : ''

  if (!title) return `${fallbackTitle} - Nexus`
  return `${title}${ticketCode ? ` · ${ticketCode}` : ''} - Nexus`
}
