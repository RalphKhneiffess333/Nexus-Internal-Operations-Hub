import { useCallback, useEffect, useState } from 'react'
import { getPriorities } from './priority-api'
import { useLatestRequest } from '../../lib/api/use-latest-request'

function normalizePriorities(result) {
  return Array.isArray(result) ? result : []
}

export function usePriorities() {
  const [priorities, setPriorities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { beginRequest } = useLatestRequest()

  const load = useCallback(async ({ background = false } = {}) => {
    const request = beginRequest()
    if (!background) {
      setLoading(true)
      setError('')
    }
    try {
      const result = normalizePriorities(await getPriorities({ signal: request.controller.signal }))
      if (!request.isCurrent()) return
      setPriorities(result)
      setError('')
    } catch (loadError) {
      if (!request.isCurrent()) return
      if (background) return
      setPriorities([])
      setError(loadError.message || 'Unable to load priorities. Please try again.')
    } finally {
      if (request.isCurrent() && !background) setLoading(false)
    }
  }, [beginRequest])

  const reload = useCallback(() => load(), [load])

  useEffect(() => {
    // The priority hook owns the initial reference-data synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  useEffect(() => {
    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible' && !loading) {
        void load({ background: true })
      }
    }
    window.addEventListener('focus', refreshWhenActive)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      window.removeEventListener('focus', refreshWhenActive)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [load, loading])

  return { priorities, loading, error, reload }
}

export function priorityLabel(code, priorities = []) {
  return priorities.find((priority) => priority.code === code)?.name ?? code
}
