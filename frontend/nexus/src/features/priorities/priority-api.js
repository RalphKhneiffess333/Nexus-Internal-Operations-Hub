import { apiRequest } from '../../lib/api/client'

export function getPriorities(requestOptions = {}) {
  return apiRequest('/priorities', requestOptions)
}
