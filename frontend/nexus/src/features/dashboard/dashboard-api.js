import { apiRequest } from '../../lib/api/client'

export function getDashboardSummary(requestOptions = {}) {
  return apiRequest('/dashboard/summary', requestOptions)
}
