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

export function getChatMessages(ticketId) {
  return apiRequest(`/tickets/${ticketId}/chat/messages`)
}

export function createChatMessage(ticketId, content, files = []) {
  if (files.length === 0) {
    return apiRequest(`/tickets/${ticketId}/chat/messages`, {
      method: 'POST',
      body: { content },
    })
  }

  return apiRequest(`/tickets/${ticketId}/chat/messages`, {
    method: 'POST',
    body: multipartBody({ content }, files),
  })
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

function canViewFileInBrowser(mimeType) {
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('audio/') ||
    mimeType.startsWith('video/') ||
    [
      'application/pdf',
      'application/json',
      'application/xml',
      'text/plain',
      'text/markdown',
      'text/csv',
      'text/xml',
    ].includes(mimeType)
  )
}

function saveBlob(result) {
  const url = URL.createObjectURL(result.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = result.filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function fetchChatAttachment(ticketId, messageId, attachmentId) {
  return downloadApiFile(
    `/tickets/${ticketId}/chat/messages/${messageId}/attachments/${attachmentId}`,
  )
}

async function fetchTicketAttachment(ticketId, eventId, attachmentId) {
  return downloadApiFile(
    `/tickets/${ticketId}/events/${eventId}/attachments/${attachmentId}`,
  )
}

async function openAttachment(fetchAttachment) {
  const viewer = window.open('', '_blank')
  try {
    const result = await fetchAttachment()
    if (!canViewFileInBrowser(result.blob.type)) {
      viewer?.close()
      saveBlob(result)
      return
    }

    const url = URL.createObjectURL(result.blob)
    if (viewer) {
      viewer.opener = null
      viewer.location.replace(url)
    } else {
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    viewer?.close()
    throw error
  }
}

export async function openTicketAttachment(ticketId, eventId, attachmentId) {
  return openAttachment(() => fetchTicketAttachment(ticketId, eventId, attachmentId))
}

export async function downloadTicketAttachment(ticketId, eventId, attachmentId) {
  saveBlob(await fetchTicketAttachment(ticketId, eventId, attachmentId))
}

export async function openChatAttachment(ticketId, messageId, attachmentId) {
  return openAttachment(() => fetchChatAttachment(ticketId, messageId, attachmentId))
}

export async function downloadChatAttachment(ticketId, messageId, attachmentId) {
  saveBlob(await fetchChatAttachment(ticketId, messageId, attachmentId))
}
