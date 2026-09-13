import { apiRequest } from '../../lib/api/client'

export function getTickets() {
  return apiRequest('/tickets')
}

export function getTicket(ticketId) {
  return apiRequest(`/tickets/${ticketId}`)
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
