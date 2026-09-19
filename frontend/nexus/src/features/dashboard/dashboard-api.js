import { apiRequest } from '../../lib/api/client'

export function getDashboardSummary() {
  return apiRequest('/dashboard/summary')
}
