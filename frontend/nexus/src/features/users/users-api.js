import { apiRequest } from '../../lib/api/client'

export function getUser(userId, requestOptions = {}) {
  return apiRequest(`/users/${userId}`, requestOptions)
}
