import { apiRequest } from '../../lib/api/client'

export function sendAssistantMessage(message, conversationId) {
  return apiRequest('/ai/messages', {
    method: 'POST',
    body: {
      message,
      ...(conversationId ? { conversationId } : {}),
    },
  })
}
