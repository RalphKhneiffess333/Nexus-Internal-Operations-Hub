import { apiRequest, apiUrl } from '../../lib/api/client'

export function getCurrentAuthentication(requestOptions = {}) {
  return apiRequest('/authentication/me', requestOptions)
}

export function getMicrosoftLoginUrl() {
  return apiUrl('/authentication/microsoft/login')
}

export function logout() {
  return apiRequest('/authentication/logout', { method: 'POST' })
}
