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

export function getTickets() {
  return apiRequest('/tickets')
}

export function getSubmittedTickets() {
  return apiRequest('/tickets/submitted')
}

export function getClaimedTickets() {
  return apiRequest('/tickets/claimed')
}

export function getResolvedTickets() {
  return apiRequest('/tickets/resolved')
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
