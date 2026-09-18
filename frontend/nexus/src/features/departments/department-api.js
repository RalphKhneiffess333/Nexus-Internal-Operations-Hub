import { apiRequest } from '../../lib/api/client'

export function getDepartments() {
  return apiRequest('/departments')
}

export function getMyDepartments() {
  return apiRequest('/departments/mine')
}
