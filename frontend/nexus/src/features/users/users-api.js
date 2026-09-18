import { apiRequest } from '../../lib/api/client'

export function getUser(userId) {
  return apiRequest(`/users/${userId}`)
}
