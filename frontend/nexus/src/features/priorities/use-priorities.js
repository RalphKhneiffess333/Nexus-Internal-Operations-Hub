import { useCallback, useEffect, useState } from 'react'
import { getPriorities } from './priority-api'

function normalizePriorities(result) {
  return Array.isArray(result) ? result : []
}

export function usePriorities() {
  const [priorities, setPriorities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setPriorities(normalizePriorities(await getPriorities()))
    } catch (loadError) {
      setPriorities([])
      setError(loadError.message || 'Unable to load priorities. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const result = normalizePriorities(await getPriorities())
        if (active) setPriorities(result)
      } catch (loadError) {
        if (active) {
          setPriorities([])
          setError(loadError.message || 'Unable to load priorities. Please try again.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible') void load()
    }
    window.addEventListener('focus', refreshWhenActive)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      active = false
      window.removeEventListener('focus', refreshWhenActive)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [])

  return { priorities, loading, error, reload }
}

export function priorityLabel(code, priorities = []) {
  return priorities.find((priority) => priority.code === code)?.name ?? code
}
