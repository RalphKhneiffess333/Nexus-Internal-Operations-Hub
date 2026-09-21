import { apiRequest } from '../../lib/api/client'

function withQuery(path, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  return `${path}${query.toString() ? `?${query}` : ''}`
}

export function getDepartments(params = {}, requestOptions = {}) {
  return apiRequest(withQuery('/departments', params), requestOptions)
}

export function getMyDepartments() {
  return getDepartments({ scope: 'mine' })
}
