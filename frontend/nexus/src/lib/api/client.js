const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function userFacingMessage(status, payload) {
  if (status >= 500) {
    return 'The service is temporarily unavailable. Please try again.'
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message
  }

  if (Array.isArray(payload?.message) && payload.message.length > 0) {
    return payload.message.join(' ')
  }

  if (status === 404) {
    return 'This resource could not be found.'
  }

  if (status === 400) {
    return 'This request could not be completed. The ticket may have changed since you opened it.'
  }

  return 'Something went wrong. Please try again.'
}

export async function apiRequest(path, options = {}) {
  const { method = 'GET', body } = options
  const headers = { Accept: 'application/json' }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      'Unable to reach Nexus. Check your connection and try again.',
      0,
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  let payload = null

  if (isJson) {
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    throw new ApiError(userFacingMessage(response.status, payload), response.status)
  }

  if (!isJson) {
    throw new ApiError('The server returned an unexpected response.', response.status)
  }

  return payload
}
