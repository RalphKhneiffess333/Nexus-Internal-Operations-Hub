import { apiRequest, downloadApiFile } from '../../lib/api/client'

function multipartBody(fields, files = []) {
  const body = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      body.append(key, value)
    }
  })
  files.forEach((file) => body.append('files', file))
  return body
}

function withQuery(path, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  return `${path}${query.toString() ? `?${query}` : ''}`
}

export function getTickets(params = {}) {
  return apiRequest(withQuery('/tickets', params))
}

export function getSubmittedTickets(params = {}) {
  return apiRequest(withQuery('/tickets/submitted', params))
}

export function getClaimedTickets(params = {}) {
  return apiRequest(withQuery('/tickets/claimed', params))
}

export function getResolvedTickets(params = {}) {
  return apiRequest(withQuery('/tickets/resolved', params))
}

export function getDepartmentTickets(params = {}) {
  return apiRequest(withQuery('/tickets/department', params))
}

export function getTicketPool(params = {}) {
  return apiRequest(withQuery('/tickets/pool', params))
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

export function getTicketHandoffs(ticketId, status) {
  return apiRequest(withQuery(`/tickets/${ticketId}/handoffs`, { status }))
}

export function getEligibleHandoffAgents(ticketId) {
  return apiRequest(`/tickets/${ticketId}/handoffs/eligible-agents`)
}

export function createHandoff(ticketId, data) {
  return apiRequest(`/tickets/${ticketId}/handoffs`, {
    method: 'POST',
    body: data,
  })
}

export function acceptHandoff(handoffId) {
  return apiRequest(`/handoffs/${handoffId}/accept`, { method: 'POST' })
}

export function rejectHandoff(handoffId) {
  return apiRequest(`/handoffs/${handoffId}/reject`, { method: 'POST' })
}

export function cancelHandoff(handoffId) {
  return apiRequest(`/handoffs/${handoffId}/cancel`, { method: 'POST' })
}

export function getIncomingHandoffs(params = {}) {
  return apiRequest(withQuery('/handoffs/incoming', params))
}

export function getOutgoingHandoffs(params = {}) {
  return apiRequest(withQuery('/handoffs/outgoing', params))
}

export function getHandoffs(params = {}) {
  return apiRequest(withQuery('/handoffs', params))
}

export function createTicket(data, files = []) {
  return apiRequest('/tickets', {
    method: 'POST',
    body: multipartBody(data, files),
  })
}

export function updateTicket(ticketId, data, files = [], removedAttachmentIds = []) {
  return apiRequest(`/tickets/${ticketId}`, {
    method: 'PATCH',
    body: multipartBody(
      {
        ...data,
        removedAttachmentIds: JSON.stringify(removedAttachmentIds),
      },
      files,
    ),
  })
}

export function cancelTicket(ticketId) {
  return apiRequest(`/tickets/${ticketId}/cancel`, { method: 'POST' })
}

export function claimTicket(ticketId) {
  return apiRequest(`/tickets/${ticketId}/claim`, { method: 'POST' })
}

export function closeTicket(ticketId, data, files = []) {
  return apiRequest(`/tickets/${ticketId}/close`, {
    method: 'POST',
    body: multipartBody(data, files),
  })
}

export function reopenTicket(ticketId, data, files = []) {
  return apiRequest(`/tickets/${ticketId}/reopen`, {
    method: 'POST',
    body: multipartBody(data, files),
  })
}

export async function downloadTicketAttachment(
  ticketId,
  eventId,
  attachmentId,
) {
  const result = await downloadApiFile(
    `/tickets/${ticketId}/events/${eventId}/attachments/${attachmentId}`,
  )
  const url = URL.createObjectURL(result.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = result.filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
