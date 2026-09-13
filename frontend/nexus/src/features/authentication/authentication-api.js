import { apiRequest, apiUrl } from '../../lib/api/client'

export function getCurrentAuthentication() {
  return apiRequest('/authentication/me')
}

export function getMicrosoftLoginUrl() {
  return apiUrl('/authentication/microsoft/login')
}

export function logout() {
  return apiRequest('/authentication/logout', { method: 'POST' })
}
