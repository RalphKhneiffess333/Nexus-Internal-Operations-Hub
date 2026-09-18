import { ApiError, apiRequest } from '../../lib/api/client'

export async function getTestAuthentication() {
  try {
    return await apiRequest('/__test/auth')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }

    throw error
  }
}

export function loginAsTestUser(userId) {
  return apiRequest('/__test/auth/login', {
    method: 'POST',
    body: { userId },
  })
}
