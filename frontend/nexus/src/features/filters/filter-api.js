import { apiRequest } from '../../lib/api/client'

export function getFilterOptions(requestOptions = {}) {
  return apiRequest('/filters', requestOptions)
}
