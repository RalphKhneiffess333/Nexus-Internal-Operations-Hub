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

  const reload = useCallback(async () => {
    const request = beginRequest()
    setLoading(true)
    setError('')
    try {
      const result = normalizePriorities(await getPriorities({ signal: request.controller.signal }))
      if (!request.isCurrent()) return
      setPriorities(result)
    } catch (loadError) {
      if (!request.isCurrent()) return
      setPriorities([])
      setError(loadError.message || 'Unable to load priorities. Please try again.')
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [beginRequest])

  useEffect(() => {
    const load = async () => {
      const request = beginRequest()
      setLoading(true)
      setError('')
      try {
        const result = normalizePriorities(await getPriorities({ signal: request.controller.signal }))
        if (request.isCurrent()) setPriorities(result)
      } catch (loadError) {
        if (request.isCurrent()) {
          setPriorities([])
          setError(loadError.message || 'Unable to load priorities. Please try again.')
        }
      } finally {
        if (request.isCurrent()) setLoading(false)
      }
    }

    void load()

    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible') void load()
    }
    window.addEventListener('focus', refreshWhenActive)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      window.removeEventListener('focus', refreshWhenActive)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [beginRequest])

  return { priorities, loading, error, reload }
}

export function priorityLabel(code, priorities = []) {
  return priorities.find((priority) => priority.code === code)?.name ?? code
}
