import { apiRequest } from '../../lib/api/client'

export function getPriorities() {
  return apiRequest('/priorities')
}
