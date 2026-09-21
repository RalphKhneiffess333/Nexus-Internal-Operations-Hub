import { useCallback, useEffect, useState } from 'react'
import { useOperationsSocket } from '../realtime/use-operations-socket'
import { getTicket } from './ticket-api'
import { useLatestRequest } from '../../lib/api/use-latest-request'

export function useTicketDetails(ticketId, onRemoteUpdate) {
  const { subscribeToTicket } = useOperationsSocket()
  const { beginRequest } = useLatestRequest()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async ({ silent = false } = {}) => {
    const request = beginRequest()
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const result = await getTicket(ticketId, { signal: request.controller.signal })
      if (!request.isCurrent()) return
      setTicket(result)
    } catch (loadError) {
      if (!request.isCurrent()) return
      if (!silent) {
        setTicket(null)
        setError(loadError.message || 'Unable to load this ticket. Please try again.')
      }
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [beginRequest, ticketId])

  const updateTicket = useCallback((nextTicket) => {
    setTicket(nextTicket)
  }, [])

  useEffect(() => {
    // The ticket hook owns the initial resource synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  useEffect(
    () => subscribeToTicket(ticketId, (event) => {
      if (event?.payload?.active === false) {
        setTicket((currentTicket) => currentTicket
          ? {
              ...currentTicket,
              active: false,
              status: event.payload.status ?? currentTicket.status,
              updatedAt: event.payload.updatedAt ?? currentTicket.updatedAt,
              permissions: {
                ...currentTicket.permissions,
                canModify: false,
                canCancel: false,
                canClaim: false,
                canClose: false,
                canReopen: false,
              },
            }
          : currentTicket)
        return
      }

      setTicket((currentTicket) => currentTicket
        ? {
            ...currentTicket,
            status: event?.payload?.status ?? currentTicket.status,
            updatedAt: event?.payload?.updatedAt ?? currentTicket.updatedAt,
          }
        : currentTicket)
      void reload({ silent: true })
      onRemoteUpdate?.()
    }),
    [onRemoteUpdate, reload, subscribeToTicket, ticketId],
  )

  return { ticket, loading, error, reload, updateTicket }
}
