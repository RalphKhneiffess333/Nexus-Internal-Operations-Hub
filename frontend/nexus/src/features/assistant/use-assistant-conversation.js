import { useContext } from 'react'
import { AssistantConversationContext } from './assistant-conversation-context'

export function useAssistantConversation() {
  const context = useContext(AssistantConversationContext)
  if (!context) {
    throw new Error('useAssistantConversation must be used inside AssistantConversationProvider')
  }
  return context
}
