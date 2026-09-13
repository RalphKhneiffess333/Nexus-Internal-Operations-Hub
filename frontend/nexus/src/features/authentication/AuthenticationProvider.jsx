import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getCurrentAuthentication,
  getMicrosoftLoginUrl,
  logout,
} from './authentication-api'
import { AuthenticationContext } from './authentication-context'

export function AuthenticationProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshAuthentication = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const authentication = await getCurrentAuthentication()
      setUser(authentication?.user ?? null)
    } catch (loadError) {
      setUser(null)
      setError(
        loadError.message ||
          'Unable to check your session. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadInitialAuthentication() {
      try {
        const authentication = await getCurrentAuthentication()
        if (active) {
          setUser(authentication?.user ?? null)
        }
      } catch (loadError) {
        if (active) {
          setUser(null)
          setError(
            loadError.message ||
              'Unable to check your session. Please try again.',
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadInitialAuthentication()

    return () => {
      active = false
    }
  }, [])

  const loginWithMicrosoft = useCallback(() => {
    window.location.assign(getMicrosoftLoginUrl())
  }, [])

  const logoutCurrentSession = useCallback(async () => {
    await logout()
    setUser(null)
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
