import { useCallback, useEffect, useRef } from 'react'

export function useLatestRequest() {
  const activeRequestRef = useRef(null)

  const beginRequest = useCallback(() => {
    activeRequestRef.current?.controller.abort()

    const controller = new AbortController()
    const request = {
      controller,
      isCurrent: () => activeRequestRef.current === request,
    }

    activeRequestRef.current = request
    return request
  }, [])

  const cancelRequest = useCallback(() => {
    activeRequestRef.current?.controller.abort()
    activeRequestRef.current = null
  }, [])

  useEffect(() => cancelRequest, [cancelRequest])

  return { beginRequest, cancelRequest }
}
