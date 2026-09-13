import { apiRequest } from '../../lib/api/client'

export function getDepartments() {
  return apiRequest('/departments')
}
