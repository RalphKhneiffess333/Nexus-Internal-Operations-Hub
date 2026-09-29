import { useState } from 'react'
import { AssistantConversationContext } from './assistant-conversation-context'

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hey, I’m the Nexus Assistant. I can help you prefill new requests or look up a ticket by its number. What can I help you with?',
}

export function AssistantConversationProvider({ children }) {
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState([WELCOME_MESSAGE])

  return (
    <AssistantConversationContext.Provider
      value={{ conversationId, setConversationId, messages, setMessages }}
    >
      {children}
    </AssistantConversationContext.Provider>
  )
}
