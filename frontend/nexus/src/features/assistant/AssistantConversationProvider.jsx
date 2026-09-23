import { useState } from 'react'
import { AssistantConversationContext } from './assistant-conversation-context'

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Tell me what happened and I’ll help you work through it. If a submission is still needed, I’ll ask before prefilling the form.',
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
