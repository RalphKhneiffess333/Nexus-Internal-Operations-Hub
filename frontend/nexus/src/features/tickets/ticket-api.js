import { apiRequest } from '../../lib/api/client'

export function getTickets() {
  return apiRequest('/tickets')
}

export function getSubmittedTickets() {
  return apiRequest('/tickets/submitted')
}

export function getDepartmentTickets() {
  return apiRequest('/tickets/department')
}

export function getTicketPool() {
  return apiRequest('/tickets/pool')
}

export function getTicket(ticketId) {
  return apiRequest(`/tickets/${ticketId}`)
}

export function getTicketEvents(ticketId) {
  return apiRequest(`/tickets/${ticketId}/events`)
}

export function getTicketEvent(ticketId, eventId) {
  return apiRequest(`/tickets/${ticketId}/events/${eventId}`)
}

export function createTicket(data) {
  return apiRequest('/tickets', { method: 'POST', body: data })
}

export function updateTicket(ticketId, data) {
  return apiRequest(`/tickets/${ticketId}`, { method: 'PATCH', body: data })
}

export function cancelTicket(ticketId) {
  return apiRequest(`/tickets/${ticketId}/cancel`, { method: 'POST' })
}

export function claimTicket(ticketId) {
  return apiRequest(`/tickets/${ticketId}/claim`, { method: 'POST' })
}

export function closeTicket(ticketId, data) {
  return apiRequest(`/tickets/${ticketId}/close`, { method: 'POST', body: data })
}

export function reopenTicket(ticketId, data) {
  return apiRequest(`/tickets/${ticketId}/reopen`, { method: 'POST', body: data })
}
