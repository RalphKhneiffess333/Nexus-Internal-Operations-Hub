const configuredApiUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const API_BASE_URL = configuredApiUrl || '/api'

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
  const { method = 'GET', body, signal, expectJson = true } = options
  const headers = { Accept: 'application/json' }
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      signal,
      body:
        body === undefined || isFormData
          ? body
          : JSON.stringify(body),
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error
    }

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
    if (!expectJson) return null
    throw new ApiError('The server returned an unexpected response.', response.status)
  }

  return payload
}

export async function downloadApiFile(path, { signal } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      credentials: 'include',
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error
    }

    throw new ApiError(
      'Unable to reach Nexus. Check your connection and try again.',
      0,
    )
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null
    throw new ApiError(userFacingMessage(response.status, payload), response.status)
  }

  const disposition = response.headers.get('content-disposition') ?? ''
  const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const filename = encodedFilename
    ? decodeURIComponent(encodedFilename)
    : 'attachment'

  return { blob: await response.blob(), filename }
}

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}
