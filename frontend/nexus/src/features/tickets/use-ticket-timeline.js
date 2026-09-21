import { useCallback, useEffect, useState } from 'react'
import { getTicketEvent, getTicketEvents } from './ticket-api'
import { useLatestRequest } from '../../lib/api/use-latest-request'

export function useTicketTimeline(ticketId) {
  const { beginRequest: beginEventsRequest } = useLatestRequest()
  const { beginRequest: beginEventDetailRequest } = useLatestRequest()
  const [events, setEvents] = useState([])
  const [eventPage, setEventPage] = useState(1)
  const [eventsHasMore, setEventsHasMore] = useState(false)
  const [eventsLoadingMore, setEventsLoadingMore] = useState(false)
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [timelineError, setTimelineError] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventDetailLoading, setEventDetailLoading] = useState(false)
  const [eventDetailError, setEventDetailError] = useState('')

  const reload = useCallback(async ({ silent = false, page = 1, append = false } = {}) => {
    const request = beginEventsRequest()
    if (!silent) {
      if (append) setEventsLoadingMore(true)
      else setTimelineLoading(true)
      setTimelineError('')
    }
    try {
      const result = await getTicketEvents(
        ticketId,
        { page, pageSize: 50 },
        { signal: request.controller.signal },
      )
      if (!request.isCurrent()) return
      const summaries = result?.items ?? (Array.isArray(result) ? result : [])
      setEvents((current) => (append ? [...summaries, ...current] : summaries))
      setEventPage(page)
      setEventsHasMore(result?.hasMore ?? summaries.length === 50)
    } catch (loadError) {
      if (!request.isCurrent()) return
      setTimelineError(loadError.message || 'Unable to load the ticket timeline. Please try again.')
    } finally {
      if (request.isCurrent()) {
        if (append) setEventsLoadingMore(false)
        else setTimelineLoading(false)
      }
    }
  }, [beginEventsRequest, ticketId])

  const selectEvent = useCallback(async (event) => {
    const request = beginEventDetailRequest()
    if (selectedEventId === event.ticketEventId) {
      setSelectedEventId('')
      setSelectedEvent(null)
      setEventDetailError('')
      setEventDetailLoading(false)
      return
    }

    setSelectedEventId(event.ticketEventId)
    setSelectedEvent(null)
    setEventDetailError('')
    setEventDetailLoading(true)
    try {
      const result = await getTicketEvent(ticketId, event.ticketEventId, {
        signal: request.controller.signal,
      })
      if (request.isCurrent()) setSelectedEvent(result)
    } catch (detailError) {
      if (request.isCurrent()) {
        setEventDetailError(detailError.message || 'Unable to load this event. Please try again.')
      }
    } finally {
      if (request.isCurrent()) setEventDetailLoading(false)
    }
  }, [beginEventDetailRequest, selectedEventId, ticketId])

  useEffect(() => {
    // The timeline hook owns the initial event synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  return {
    events,
    eventPage,
    eventsHasMore,
    eventsLoadingMore,
    timelineLoading,
    timelineError,
    selectedEventId,
    selectedEvent,
    eventDetailLoading,
    eventDetailError,
    reload,
    selectEvent,
  }
}
