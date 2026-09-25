import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import notificationSound from '../../assets/notification.mp3'
import { useOperationsSocket } from '../realtime/use-operations-socket'
import { useAuthentication } from '../authentication/use-authentication'
import {
  getChatConversations,
  getIncomingPendingHandoffCount,
  getTicketPoolCount,
} from '../tickets/ticket-api'
import { UserRole } from '../tickets/ticket-types'
import { useLatestRequest } from '../../lib/api/use-latest-request'
import { Dialog } from '../../components/ui/Dialog'
import { NotificationsContext } from './notifications-context'

const TOAST_DURATION = 5000

function pageTitle(pathname, resourceTitle = '') {
  if (pathname === '/dashboard') return 'Dashboard - Nexus'
  if (pathname === '/chats') return 'Chats - Nexus'
  if (pathname.startsWith('/chats/')) return resourceTitle || 'Ticket Chat - Nexus'
  if (pathname === '/tickets') return 'My Tickets - Nexus'
  if (pathname === '/tickets/pool') return 'Ticket Pools - Nexus'
  if (pathname === '/tickets/handoffs') return 'Handoffs - Nexus'
  if (pathname === '/tickets/new') return 'New Ticket - Nexus'
  if (pathname.startsWith('/tickets/')) return resourceTitle || 'Ticket Details - Nexus'
  if (pathname === '/admin/management') return 'Management - Nexus'
  if (pathname === '/admin/logs') return 'Logs - Nexus'
  return 'Nexus'
}

export function NotificationProvider({ children }) {
  const { subscribeToNotifications } = useOperationsSocket()
  const { user } = useAuthentication()
  const location = useLocation()
  const navigate = useNavigate()
  const [toasts, setToasts] = useState([])
  const [blockingNotification, setBlockingNotification] = useState(null)
  const [unreadChatIds, setUnreadChatIds] = useState(() => new Set())
  const [unreadChatsReady, setUnreadChatsReady] = useState(false)
  const [chatInboxVersion, setChatInboxVersion] = useState(0)
  const [unclaimedTickets, setUnclaimedTickets] = useState(0)
  const [pendingIncomingHandoffs, setPendingIncomingHandoffs] = useState(0)
  const [resourceTitleState, setResourceTitleState] = useState(null)
  const audioContextRef = useRef(null)
  const audioBufferRef = useRef(null)
  const titleCountRef = useRef(0)
  const focusedRef = useRef(!document.hidden)
  const timersRef = useRef(new Set())
  const countRefreshTimerRef = useRef(null)
  const {
    beginRequest: beginCountRequest,
    cancelRequest: cancelCountRequest,
  } = useLatestRequest()
  const unreadChats = unreadChatIds.size
  const canViewTicketPool = user?.role === UserRole.AGENT || user?.role === UserRole.ADMIN
  const resourceTitle = resourceTitleState?.pathname === location.pathname
    ? resourceTitleState.title
    : ''

  const setResourceTitle = useCallback((title) => {
    setResourceTitleState({
      pathname: location.pathname,
      title: typeof title === 'string' ? title.trim() : '',
    })
  }, [location.pathname])

  const loadUnreadChatIds = useCallback(async (signal) => {
    const unreadIds = new Set()
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await getChatConversations(
        { page, pageSize: 100 },
        { signal },
      )
      const items = Array.isArray(result?.items) ? result.items : []
      items.forEach((conversation) => {
        if (conversation.unread && conversation.ticketId) unreadIds.add(conversation.ticketId)
      })
      hasMore = Boolean(result?.hasMore) && items.length > 0
      page += 1
    }

    return unreadIds
  }, [])

  const refreshNotificationCounts = useCallback(async () => {
    if (!user?.userId) return

    const request = beginCountRequest()
    const poolCountPromise = canViewTicketPool
      ? getTicketPoolCount({ signal: request.controller.signal })
      : Promise.resolve(null)
    const pendingIncomingHandoffsPromise = canViewTicketPool
      ? getIncomingPendingHandoffCount({ signal: request.controller.signal })
      : Promise.resolve(null)
    const unreadChatIdsPromise = loadUnreadChatIds(request.controller.signal)
    const [poolCountResult, unreadChatIdsResult, pendingIncomingHandoffsResult] = await Promise.allSettled([
      poolCountPromise,
      unreadChatIdsPromise,
      pendingIncomingHandoffsPromise,
    ])

    if (!request.isCurrent()) return
    if (unreadChatIdsResult.status === 'fulfilled') {
      setUnreadChatIds(unreadChatIdsResult.value)
      setUnreadChatsReady(true)
      setChatInboxVersion((version) => version + 1)
    }
    if (!canViewTicketPool) {
      setUnclaimedTickets(0)
      setPendingIncomingHandoffs(0)
    } else {
      if (poolCountResult.status === 'fulfilled') {
        setUnclaimedTickets(Number(poolCountResult.value?.count) || 0)
      }
      if (pendingIncomingHandoffsResult.status === 'fulfilled') {
        setPendingIncomingHandoffs(pendingIncomingHandoffsResult.value)
      }
    }
  }, [beginCountRequest, canViewTicketPool, loadUnreadChatIds, user?.userId])

  const markChatRead = useCallback((ticketId) => {
    if (!ticketId) return
    if (countRefreshTimerRef.current) {
      window.clearTimeout(countRefreshTimerRef.current)
      countRefreshTimerRef.current = null
    }
    // A count request may have read the old receipt before this chat was marked
    // read. Cancel it so it cannot restore stale unread state afterwards.
    cancelCountRequest()
    setUnreadChatIds((current) => {
      if (!current.has(ticketId)) return current
      const next = new Set(current)
      next.delete(ticketId)
      return next
    })
    setChatInboxVersion((version) => version + 1)
    // The read receipt has already been persisted by the caller. Re-read the
    // authoritative server state after invalidating any older snapshot.
    void refreshNotificationCounts()
  }, [cancelCountRequest, refreshNotificationCounts])

  const markChatUnread = useCallback((ticketId) => {
    if (!ticketId) return
    setUnreadChatIds((current) => {
      if (current.has(ticketId)) return current
      const next = new Set(current)
      next.add(ticketId)
      return next
    })
    setChatInboxVersion((version) => version + 1)
  }, [])

  const isChatUnread = useCallback(
    (ticketId) => Boolean(ticketId && unreadChatIds.has(ticketId)),
    [unreadChatIds],
  )

  const scheduleNotificationCountRefresh = useCallback(() => {
    if (countRefreshTimerRef.current) window.clearTimeout(countRefreshTimerRef.current)
    countRefreshTimerRef.current = window.setTimeout(() => {
      countRefreshTimerRef.current = null
      void refreshNotificationCounts()
    }, 250)
  }, [refreshNotificationCounts])

  const applyTitle = useCallback(() => {
    const title = pageTitle(location.pathname, resourceTitle)
    document.title = titleCountRef.current > 0 ? `(${titleCountRef.current}) - ${title}` : title
  }, [location.pathname, resourceTitle])

  const unlockAudio = useCallback(async () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      if (!audioContextRef.current) audioContextRef.current = new AudioContext()
      const context = audioContextRef.current
      if (context.state !== 'running') await context.resume()
      if (!audioBufferRef.current) {
        const response = await fetch(notificationSound)
        audioBufferRef.current = await context.decodeAudioData(await response.arrayBuffer())
      }
    } catch {
      // Browser autoplay and decoding failures must never affect live updates.
    }
  }, [])

  const playSound = useCallback(() => {
    const context = audioContextRef.current
    const buffer = audioBufferRef.current
    if (!context || !buffer || context.state !== 'running') return
    try {
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.start()
    } catch {
      // A suspended context is an expected browser restriction.
    }
  }, [])

  const dismissToast = useCallback((toastId) => {
    setToasts((current) => current.map((toast) => toast.id === toastId ? { ...toast, leaving: true } : toast))
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer)
      setToasts((current) => current.filter((toast) => toast.id !== toastId))
    }, 180)
    timersRef.current.add(timer)
  }, [])

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  useEffect(() => {
    applyTitle()
  }, [applyTitle])

  useEffect(() => {
    if (!user?.userId) {
      cancelCountRequest()
      // Reset badge state when the authenticated session disappears.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadChatIds(new Set())
      setUnreadChatsReady(false)
      setChatInboxVersion((version) => version + 1)
      setUnclaimedTickets(0)
      setPendingIncomingHandoffs(0)
      return
    }
    // Badges are initialized from server state instead of inferred from realtime deltas.
    void refreshNotificationCounts()
  }, [cancelCountRequest, refreshNotificationCounts, user?.userId])

  useEffect(() => () => {
    if (countRefreshTimerRef.current) window.clearTimeout(countRefreshTimerRef.current)
  }, [])

  useEffect(() => {
    const unlock = () => void unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      audioContextRef.current?.close()
    }
  }, [unlockAudio])

  useEffect(() => {
    const reset = () => {
      focusedRef.current = true
      titleCountRef.current = 0
      applyTitle()
      scheduleNotificationCountRefresh()
    }
    const handleVisibility = () => {
      focusedRef.current = !document.hidden
      if (focusedRef.current) reset()
    }
    window.addEventListener('focus', reset)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', reset)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [applyTitle, scheduleNotificationCountRefresh])

  useEffect(() => subscribeToNotifications((event) => {
    const notification = event.payload
    if (notification.blocking) {
      setBlockingNotification(notification)
      playSound()
      return
    }
    const isCurrentChat = notification.type === 'CHAT_MESSAGE'
      && notification.ticketId
      && location.pathname === `/chats/${notification.ticketId}`
      && focusedRef.current
    if (isCurrentChat) return
    if (notification.type === 'CHAT_MESSAGE') {
      markChatUnread(notification.ticketId)
    }
    scheduleNotificationCountRefresh()
    const toast = { id: event.eventId, ...notification }
    setToasts((current) => [...current.slice(-3), toast])
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer)
      dismissToast(toast.id)
    }, TOAST_DURATION)
    timersRef.current.add(timer)
    playSound()
    if (!focusedRef.current) {
      titleCountRef.current += 1
      applyTitle()
    }
  }), [applyTitle, dismissToast, location.pathname, markChatUnread, playSound, scheduleNotificationCountRefresh, subscribeToNotifications])

  const value = useMemo(() => ({
    unreadChats,
    unreadChatsReady,
    isChatUnread,
    chatInboxVersion,
    unclaimedTickets,
    pendingIncomingHandoffs,
    markChatRead,
    refreshNotificationCounts,
    setResourceTitle,
  }), [chatInboxVersion, isChatUnread, markChatRead, pendingIncomingHandoffs, refreshNotificationCounts, setResourceTitle, unclaimedTickets, unreadChats, unreadChatsReady])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="notification-toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <article key={toast.id} className={`notification-toast${toast.leaving ? ' is-leaving' : ''}`}>
            <button type="button" className="notification-toast-close" aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>×</button>
            <p>{toast.message}</p>
            {toast.link ? <button type="button" className="notification-toast-link" onClick={() => navigate(toast.link)}>View</button> : null}
          </article>
        ))}
      </div>
      {blockingNotification ? (
        <Dialog
          role="alertdialog"
          ariaLabelledBy="account-update-title"
          className="notification-blocking-dialog"
          backdropClassName="notification-blocking-backdrop"
          closeOnEscape={false}
          closeOnBackdrop={false}
        >
            <p className="eyebrow">Account update</p>
            <h1 id="account-update-title">Refresh required</h1>
            <p>{blockingNotification.message}</p>
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>Refresh Page</button>
        </Dialog>
      ) : null}
    </NotificationsContext.Provider>
  )
}
