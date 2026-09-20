import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuthentication } from '../../authentication/use-authentication'
import { OperationsSocketContext } from '../operations-socket-context'

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
  const chatSubscriptionsRef = useRef(new Map())
  const notificationSubscriptionsRef = useRef(new Set())
  const seenEventIdsRef = useRef(new Set())
  const hasConnectedRef = useRef(false)
  const [connectionState, setConnectionState] = useState('disconnected')

  const joinTicketRoom = useCallback((ticketId) => {
    const socket = socketRef.current
    if (!socket?.connected) return
    socket.emit('join ticket room', { ticketId })
  }, [])

  const joinChatRoom = useCallback((ticketId) => {
    const socket = socketRef.current
    if (!socket?.connected) return
    socket.emit('join chat room', { ticketId })
  }, [])

  const dispatchTicketUpdate = useCallback((event) => {
    if (!isTicketEnvelope(event)) return

    const seenEventIds = seenEventIdsRef.current
    if (seenEventIds.has(event.eventId)) return
    seenEventIds.add(event.eventId)
    if (seenEventIds.size > MAX_SEEN_EVENT_IDS) {
      seenEventIds.delete(seenEventIds.values().next().value)
    }

    // A lifecycle transition can make a visible ticket's chat newly readable.
    // Rejoin immediately so a first message after a claim is not lost before
    // the ticket details screen finishes its own HTTP refresh.
    joinChatRoom(event.ticketId)

    subscriptionsRef.current.get(event.ticketId)?.forEach((listener) => {
      listener(event)
    })
  }, [joinChatRoom])

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

  const subscribeToChat = useCallback(
    (ticketId, listener) => {
      if (!ticketId || typeof listener !== 'function') return () => {}

      const subscribers = chatSubscriptionsRef.current.get(ticketId) ?? new Set()
      subscribers.add(listener)
      chatSubscriptionsRef.current.set(ticketId, subscribers)
      joinChatRoom(ticketId)

      return () => {
        const currentSubscribers = chatSubscriptionsRef.current.get(ticketId)
        if (!currentSubscribers) return
        currentSubscribers.delete(listener)
        if (currentSubscribers.size > 0) return

        chatSubscriptionsRef.current.delete(ticketId)
        if (socketRef.current?.connected) {
          socketRef.current.emit('leave chat room', { ticketId })
        }
      }
    },
    [joinChatRoom],
  )

  const subscribeToNotifications = useCallback((listener) => {
    if (typeof listener !== 'function') return () => {}
    notificationSubscriptionsRef.current.add(listener)
    return () => notificationSubscriptionsRef.current.delete(listener)
  }, [])

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
      chatSubscriptionsRef.current.forEach((subscribers, ticketId) => {
        joinChatRoom(ticketId)
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
    socket.on('chat.message.created', (event) => {
      if (!isTicketEnvelope(event) || !event.payload?.messageId) return
      const seenEventIds = seenEventIdsRef.current
      if (seenEventIds.has(event.eventId)) return
      seenEventIds.add(event.eventId)
      if (seenEventIds.size > MAX_SEEN_EVENT_IDS) {
        seenEventIds.delete(seenEventIds.values().next().value)
      }
      chatSubscriptionsRef.current.get(event.ticketId)?.forEach((listener) => {
        listener(event)
      })
    })
    socket.on('app.notification', (event) => {
      if (!event?.eventId || !event?.payload?.message) return
      const seenEventIds = seenEventIdsRef.current
      if (seenEventIds.has(event.eventId)) return
      seenEventIds.add(event.eventId)
      if (seenEventIds.size > MAX_SEEN_EVENT_IDS) {
        seenEventIds.delete(seenEventIds.values().next().value)
      }
      notificationSubscriptionsRef.current.forEach((listener) => listener(event))
    })
    socket.connect()

    return () => {
      socket.disconnect()
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [dispatchTicketUpdate, joinChatRoom, joinTicketRoom, refreshAuthentication, user?.userId])

  const value = useMemo(
    () => ({
      connectionState,
      subscribeToTicket,
      subscribeToChat,
      subscribeToNotifications,
    }),
    [connectionState, subscribeToChat, subscribeToNotifications, subscribeToTicket],
  )

  return (
    <OperationsSocketContext.Provider value={value}>
      {children}
    </OperationsSocketContext.Provider>
  )
}


