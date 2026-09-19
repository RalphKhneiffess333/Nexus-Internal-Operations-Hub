import { useContext } from 'react'
import { OperationsSocketContext } from './operations-socket-context'

export function useOperationsSocket() {
  const context = useContext(OperationsSocketContext)
  if (!context) {
    throw new Error(
      'useOperationsSocket must be used within OperationsSocketProvider',
    )
  }
  return context
}
