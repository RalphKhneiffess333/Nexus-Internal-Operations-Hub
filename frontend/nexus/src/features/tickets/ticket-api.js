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

export function getTickets(params = {}, requestOptions = {}) {
  return apiRequest(withQuery('/tickets', params), requestOptions)
}

export function getTicketPoolCount(requestOptions = {}) {
  return apiRequest('/tickets/pool/count', requestOptions)
}

export function getTicket(ticketId, requestOptions = {}) {
  return apiRequest(`/tickets/${ticketId}`, requestOptions)
}

export function getTicketChatContext(ticketId, requestOptions = {}) {
  return apiRequest(withQuery(`/tickets/${ticketId}`, { view: 'chat' }), requestOptions)
}

export function getTicketEvents(ticketId, params = {}, requestOptions = {}) {
  return apiRequest(withQuery(`/tickets/${ticketId}/events`, params), requestOptions)
}

export function getTicketAttachments(ticketId, requestOptions = {}) {
  return apiRequest(`/tickets/${ticketId}/attachments`, requestOptions)
}

export function getChatMessages(ticketId, params = {}, requestOptions = {}) {
  return apiRequest(withQuery(`/tickets/${ticketId}/chat/messages`, params), requestOptions)
}

export function getChatConversations(params = {}, requestOptions = {}) {
  return apiRequest(withQuery('/chats', params), requestOptions)
}

export function markChatConversationRead(ticketId) {
  return apiRequest(`/chats/${ticketId}/read`, { method: 'POST', expectJson: false })
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

export function getTicketEvent(ticketId, eventId, requestOptions = {}) {
  return apiRequest(`/tickets/${ticketId}/events/${eventId}`, requestOptions)
}

export function getTicketHandoffs(ticketId, params = {}, requestOptions = {}) {
  return apiRequest(withQuery(`/tickets/${ticketId}/handoffs`, params), requestOptions)
}

export function getEligibleHandoffAgents(ticketId, requestOptions = {}) {
  return apiRequest(`/tickets/${ticketId}/handoffs/eligible-agents`, requestOptions)
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

export function getHandoffs(params = {}, requestOptions = {}) {
  return apiRequest(withQuery('/handoffs', params), requestOptions)
}

export async function getIncomingPendingHandoffCount(requestOptions = {}) {
  const result = await getHandoffs(
    { direction: 'incoming', status: 'PENDING', page: 1, pageSize: 1 },
    requestOptions,
  )
  return Number(result?.pendingCount) || 0
}

export function getHandoffParticipants(requestOptions = {}) {
  return apiRequest('/handoffs/participants', requestOptions)
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

const MIME_TYPES_BY_EXTENSION = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  json: 'application/json',
  pdf: 'application/pdf',
  xml: 'application/xml',
  csv: 'text/csv',
  md: 'text/markdown',
  txt: 'text/plain',
}

function normalizeMimeType(mimeType) {
  return typeof mimeType === 'string'
    ? mimeType.split(';', 1)[0].trim().toLowerCase()
    : ''
}

function mimeTypeFromFilename(filename) {
  const extension = typeof filename === 'string'
    ? filename.toLowerCase().split('.').pop()
    : ''
  return MIME_TYPES_BY_EXTENSION[extension] ?? ''
}

function resolveMimeType(result, attachment = {}) {
  const metadataMimeType = normalizeMimeType(attachment.mimeType)
  const responseMimeType = normalizeMimeType(result.blob.type)
  const filenameMimeType = mimeTypeFromFilename(attachment.filename || result.filename)
  return [metadataMimeType, responseMimeType, filenameMimeType]
    .find((mimeType) => mimeType && mimeType !== 'application/octet-stream')
    || metadataMimeType
    || responseMimeType
    || filenameMimeType
}

function canViewFileInBrowser(mimeType) {
  const normalizedMimeType = normalizeMimeType(mimeType)
  return (
    normalizedMimeType.startsWith('image/') ||
    normalizedMimeType.startsWith('audio/') ||
    normalizedMimeType.startsWith('video/') ||
    [
      'application/pdf',
      'application/json',
      'application/xml',
      'text/plain',
      'text/markdown',
      'text/csv',
      'text/xml',
    ].includes(normalizedMimeType)
  )
}

function withMimeType(blob, mimeType) {
  if (!mimeType || blob.type === mimeType) return blob
  return new Blob([blob], { type: mimeType })
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

async function fetchChatAttachment(ticketId, messageId, attachmentId, requestOptions = {}) {
  return downloadApiFile(
    `/tickets/${ticketId}/chat/messages/${messageId}/attachments/${attachmentId}`,
    requestOptions,
  )
}

async function fetchTicketAttachment(ticketId, eventId, attachmentId, requestOptions = {}) {
  return downloadApiFile(
    `/tickets/${ticketId}/events/${eventId}/attachments/${attachmentId}`,
    requestOptions,
  )
}

function writeViewerMessage(viewer, message) {
  if (!viewer || viewer.closed) return false
  viewer.document.open()
  viewer.document.write(`<!doctype html>
    <html><head><title>${message}</title></head>
    <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f9fd;color:#53627c;font:600 14px system-ui,sans-serif">
      <div style="display:grid;justify-items:center;gap:12px;text-align:center">
        <span style="width:28px;height:28px;border:3px solid #dfe5f0;border-top-color:#4967d9;border-radius:50%;animation:spin .75s linear infinite"></span>
        <span>${message}</span>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </body></html>`)
  viewer.document.close()
  return true
}

function writeImagePreview(viewer, url) {
  if (!viewer || viewer.closed) return false
  viewer.document.open()
  viewer.document.write(`<!doctype html>
    <html><head><title>Attachment preview</title></head>
    <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#111827;color:#e5e7eb;font:600 14px system-ui,sans-serif">
      <div style="display:grid;justify-items:center;gap:14px;max-width:100vw;max-height:100vh;padding:20px;box-sizing:border-box">
        <span id="attachment-status">Loading preview…</span>
        <img id="attachment-image" alt="Attachment preview" style="display:block;max-width:calc(100vw - 40px);max-height:calc(100vh - 90px);object-fit:contain;opacity:0;transition:opacity .18s ease" />
      </div>
    </body></html>`)
  viewer.document.close()

  const image = viewer.document.getElementById('attachment-image')
  const status = viewer.document.getElementById('attachment-status')
  if (!image || !status) return false

  image.addEventListener('load', () => {
    image.style.opacity = '1'
    status.remove()
    URL.revokeObjectURL(url)
  }, { once: true })
  image.addEventListener('error', () => {
    status.textContent = 'This image could not be previewed. Return to Nexus to download it.'
    URL.revokeObjectURL(url)
  }, { once: true })
  image.src = url
  return true
}

async function openAttachment(fetchAttachment, attachment = {}) {
  const viewer = window.open('', '_blank')
  if (viewer) {
    viewer.opener = null
    writeViewerMessage(viewer, 'Loading attachment…')
  }
  try {
    const result = await fetchAttachment()
    const mimeType = resolveMimeType(result, attachment)
    if (!canViewFileInBrowser(mimeType)) {
      viewer?.close()
      saveBlob(result)
      return
    }

    const url = URL.createObjectURL(withMimeType(result.blob, mimeType))
    if (viewer && !viewer.closed) {
      if (mimeType.startsWith('image/')) {
        writeImagePreview(viewer, url)
      } else {
        viewer.location.replace(url)
        window.setTimeout(() => URL.revokeObjectURL(url), 300_000)
      }
    } else {
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 300_000)
    }
  } catch (error) {
    viewer?.close()
    throw error
  }
}

export async function openTicketAttachment(ticketId, eventId, attachmentId, attachment = {}) {
  return openAttachment(
    () => fetchTicketAttachment(ticketId, eventId, attachmentId),
    attachment,
  )
}

export async function downloadTicketAttachment(ticketId, eventId, attachmentId) {
  saveBlob(await fetchTicketAttachment(ticketId, eventId, attachmentId))
}

export async function openChatAttachment(ticketId, messageId, attachmentId, attachment = {}) {
  return openAttachment(
    () => fetchChatAttachment(ticketId, messageId, attachmentId),
    attachment,
  )
}

export async function downloadChatAttachment(ticketId, messageId, attachmentId) {
  saveBlob(await fetchChatAttachment(ticketId, messageId, attachmentId))
}
