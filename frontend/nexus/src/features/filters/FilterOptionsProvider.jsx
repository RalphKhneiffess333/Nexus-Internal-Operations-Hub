import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthentication } from '../authentication/use-authentication'
import { useOperationsSocket } from '../realtime/use-operations-socket'
import { getFilterOptions } from './filter-api'
import { FilterOptionsContext } from './filter-options-context'

const EMPTY_FILTER_OPTIONS = {
  departments: [],
  myDepartments: [],
  priorities: [],
  ticketStatuses: [],
  handoffStatuses: [],
  handoffParticipants: [],
}

const filterOptionsCache = new Map()
const filterOptionsRequests = new Map()
const filterOptionsRevisions = new Map()

function normalizeFilterOptions(result) {
  return {
    departments: Array.isArray(result?.departments) ? result.departments : [],
    myDepartments: Array.isArray(result?.myDepartments) ? result.myDepartments : [],
    priorities: Array.isArray(result?.priorities) ? result.priorities : [],
    ticketStatuses: Array.isArray(result?.ticketStatuses) ? result.ticketStatuses : [],
    handoffStatuses: Array.isArray(result?.handoffStatuses) ? result.handoffStatuses : [],
    handoffParticipants: Array.isArray(result?.handoffParticipants) ? result.handoffParticipants : [],
  }
}

function fetchFilterOptions(userId) {
  const cached = filterOptionsCache.get(userId)
  if (cached) return Promise.resolve(cached)

  const pending = filterOptionsRequests.get(userId)
  if (pending) return pending

  const requestRevision = filterOptionsRevisions.get(userId) ?? 0
  const request = getFilterOptions()
    .then((result) => {
      const options = normalizeFilterOptions(result)
      if (filterOptionsRevisions.get(userId) !== requestRevision) {
        return filterOptionsCache.get(userId) ?? options
      }
      filterOptionsCache.set(userId, options)
      return options
    })
    .finally(() => filterOptionsRequests.delete(userId))

  filterOptionsRequests.set(userId, request)
  return request
}

export function FilterOptionsProvider({ children }) {
  const { user } = useAuthentication()
  const { subscribeToFilterOptions } = useOperationsSocket()
  const userId = user?.userId ?? ''
  const currentUserIdRef = useRef(userId)
  const [options, setOptions] = useState(EMPTY_FILTER_OPTIONS)
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState('')

  useEffect(() => {
    currentUserIdRef.current = userId
  }, [userId])

  const load = useCallback(async ({ force = false, background = false } = {}) => {
    if (!userId) {
      setOptions(EMPTY_FILTER_OPTIONS)
      setLoading(false)
      setError('')
      return
    }

    if (!force) {
      const cached = filterOptionsCache.get(userId)
      if (cached) {
        setOptions(cached)
        setLoading(false)
        setError('')
        return cached
      }
    }

    if (force) filterOptionsCache.delete(userId)
    if (!background) setLoading(true)
    try {
      const result = await fetchFilterOptions(userId)
      if (userId !== currentUserIdRef.current) return result
      setOptions(result)
      setError('')
      return result
    } catch (loadError) {
      if (userId !== currentUserIdRef.current) return undefined
      if (!background) {
        setOptions(EMPTY_FILTER_OPTIONS)
        setError(loadError.message || 'Unable to load filter options. Please try again.')
      }
      return undefined
    } finally {
      if (userId === currentUserIdRef.current && !background) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // Filter options are shared across all routes for the current user.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  useEffect(() => subscribeToFilterOptions((event) => {
    if (event?.type === 'reconnected') {
      void load({ force: true, background: true })
      return
    }
    if (!event?.payload || !userId) return

    const nextOptions = normalizeFilterOptions(event.payload)
    filterOptionsCache.set(userId, nextOptions)
    filterOptionsRevisions.set(userId, (filterOptionsRevisions.get(userId) ?? 0) + 1)
    setOptions(nextOptions)
    setLoading(false)
    setError('')
  }), [load, subscribeToFilterOptions, userId])

  const reload = useCallback(() => load({ force: true }), [load])
  const value = useMemo(() => ({
    ...options,
    loading,
    error,
    reload,
  }), [error, loading, options, reload])

  return (
    <FilterOptionsContext.Provider value={value}>
      {children}
    </FilterOptionsContext.Provider>
  )
}
