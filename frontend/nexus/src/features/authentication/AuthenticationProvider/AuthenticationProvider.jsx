import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getCurrentAuthentication,
  getMicrosoftLoginUrl,
  logout,
} from '../authentication-api'
import { AuthenticationContext } from '../authentication-context'
import { useLatestRequest } from '../../../lib/api/use-latest-request'

export function AuthenticationProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { beginRequest } = useLatestRequest()

  const refreshAuthentication = useCallback(async () => {
    const request = beginRequest()
    setLoading(true)
    setError('')
    try {
      const authentication = await getCurrentAuthentication({ signal: request.controller.signal })
      if (!request.isCurrent()) return
      setUser(authentication?.user ?? null)
    } catch (loadError) {
      if (!request.isCurrent()) return
      setUser(null)
      setError(
        loadError.message ||
          'Unable to check your session. Please try again.',
      )
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [beginRequest])

  useEffect(() => {
    // The initial session request synchronizes authentication state from the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshAuthentication()
  }, [refreshAuthentication])

  const loginWithMicrosoft = useCallback(() => {
    window.location.assign(getMicrosoftLoginUrl())
  }, [])

  const logoutCurrentSession = useCallback(async () => {
    try {
      await logout()
    } catch {
      // Clear the local session even if the server logout request fails.
    } finally {
      setUser(null)
      setError('')
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      authenticated: Boolean(user),
      loginWithMicrosoft,
      logoutCurrentSession,
      refreshAuthentication,
    }),
    [
      user,
      loading,
      error,
      loginWithMicrosoft,
      logoutCurrentSession,
      refreshAuthentication,
    ],
  )

  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  )
}
