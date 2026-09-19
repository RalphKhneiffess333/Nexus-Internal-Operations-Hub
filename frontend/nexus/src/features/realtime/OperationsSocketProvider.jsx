import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuthentication } from '../authentication/use-authentication'
import { OperationsSocketContext } from './operations-socket-context'

const MAX_SEEN_EVENT_IDS = 500

function operationsUrl() {
  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
  if (!configuredApiUrl || configuredApiUrl.startsWith('/')) {
    return '/operations'
  }

  return `${configuredApiUrl.replace(/\/?api\/?$/, '').replace(/\/$/, '')}/operations`
}

function isTicketEnvelope(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.eventId === 'string' &&
    typeof value.ticketId === 'string' &&
    typeof value.occurredAt === 'string' &&
    typeof value.version === 'number'
  )
}

export function OperationsSocketProvider({ children }) {
  const { user, refreshAuthentication } = useAuthentication()
  const socketRef = useRef(null)
  const subscriptionsRef = useRef(new Map())
  const seenEventIdsRef = useRef(new Set())
  const hasConnectedRef = useRef(false)
  const [connectionState, setConnectionState] = useState('disconnected')

  const joinTicketRoom = useCallback((ticketId) => {
    const socket = socketRef.current
    if (!socket?.connected) return
    socket.emit('join ticket room', { ticketId })
  }, [])

  const dispatchTicketUpdate = useCallback((event) => {
    if (!isTicketEnvelope(event)) return

    const seenEventIds = seenEventIdsRef.current
    if (seenEventIds.has(event.eventId)) return
    seenEventIds.add(event.eventId)
    if (seenEventIds.size > MAX_SEEN_EVENT_IDS) {
      seenEventIds.delete(seenEventIds.values().next().value)
    }

    subscriptionsRef.current.get(event.ticketId)?.forEach((listener) => {
      listener(event)
    })
  }, [])

  const subscribeToTicket = useCallback(
    (ticketId, listener) => {
      if (!ticketId || typeof listener !== 'function') return () => {}

      const subscribers = subscriptionsRef.current.get(ticketId) ?? new Set()
      subscribers.add(listener)
      subscriptionsRef.current.set(ticketId, subscribers)
      joinTicketRoom(ticketId)

      return () => {
        const currentSubscribers = subscriptionsRef.current.get(ticketId)
        if (!currentSubscribers) return
        currentSubscribers.delete(listener)
        if (currentSubscribers.size > 0) return

        subscriptionsRef.current.delete(ticketId)
        const socket = socketRef.current
        if (socket?.connected) {
          socket.emit('leave ticket room', { ticketId })
        }
      }
    },
    [joinTicketRoom],
  )

  useEffect(() => {
    if (!user?.userId) {
      socketRef.current?.disconnect()
      socketRef.current = null
      hasConnectedRef.current = false
      return undefined
    }

    const socket = io(operationsUrl(), {
      autoConnect: false,
      path: '/socket.io',
      withCredentials: true,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      const reconnected = hasConnectedRef.current
      hasConnectedRef.current = true
      setConnectionState('connected')

      subscriptionsRef.current.forEach((subscribers, ticketId) => {
        joinTicketRoom(ticketId)
        if (reconnected) {
          subscribers.forEach((listener) => {
            listener({ type: 'reconnected', ticketId })
          })
        }
      })
    })
    socket.on('disconnect', (reason) => {
      setConnectionState('reconnecting')
      if (reason === 'io server disconnect') {
        socket.connect()
      }
    })
    socket.on('connect_error', () => setConnectionState('error'))
    socket.on('operations.error', ({ code } = {}) => {
      if (code === 'UNAUTHORIZED') {
        void refreshAuthentication()
      }
    })
    socket.on('ticket.updated', dispatchTicketUpdate)
    socket.on('ticket.event.created', dispatchTicketUpdate)
    socket.connect()

    return () => {
      socket.disconnect()
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [dispatchTicketUpdate, joinTicketRoom, refreshAuthentication, user?.userId])

  const value = useMemo(
    () => ({
      connectionState,
      subscribeToTicket,
    }),
    [connectionState, subscribeToTicket],
  )

  return (
    <OperationsSocketContext.Provider value={value}>
      {children}
    </OperationsSocketContext.Provider>
  )
}
