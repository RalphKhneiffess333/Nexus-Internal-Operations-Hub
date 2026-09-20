import { apiRequest } from '../../lib/api/client'

function withQuery(path, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  return `${path}${query.toString() ? `?${query}` : ''}`
}

export function getDepartments(params = {}) {
  return apiRequest(withQuery('/departments', params))
}

export function getMyDepartments() {
  return getDepartments({ scope: 'mine' })
}
