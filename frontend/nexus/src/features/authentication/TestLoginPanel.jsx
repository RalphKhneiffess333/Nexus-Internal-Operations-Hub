import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getTestAuthentication,
  loginAsTestUser,
} from './test-authentication-api'
import { useAuthentication } from './use-authentication'
import { AppSelect } from '../../components/ui/AppSelect'
import { ApiError } from '../../lib/api/client'

function userOptionLabel(user) {
  const departments = user.departments.map((department) => department.code)
  const scope = departments.length > 0 ? ` · ${departments.join(', ')}` : ''
  return `${user.fullName} · ${user.role}${scope}`
}

export function TestLoginPanel() {
  const { refreshAuthentication } = useAuthentication()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function detectTestMode() {
      try {
        const configuration = await getTestAuthentication()
        if (!active || !configuration?.enabled) {
          return
        }

        const availableUsers = configuration.users ?? []
        setUsers(availableUsers)
        setSelectedUserId(availableUsers[0]?.userId ?? '')
      } catch {
        // Test login is optional and must not affect the normal login flow.
      }
    }

    void detectTestMode()

    return () => {
      active = false
    }
  }, [])

  if (users.length === 0) {
    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedUserId || submitting) {
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await loginAsTestUser(selectedUserId)
      await refreshAuthentication()
    } catch (loginError) {
      if (
        loginError instanceof ApiError &&
        loginError.status === 401 &&
        loginError.message === 'The selected test user is inactive'
      ) {
        navigate('/?account=deactivated', { replace: true })
        return
      }

      setError(loginError.message || 'Unable to start the test session.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="test-login-panel" onSubmit={handleSubmit}>
      <div className="test-login-heading">
        <span className="test-mode-badge">Test mode</span>
        <span>Bypass Microsoft authentication</span>
      </div>
      <label className="test-user-field" htmlFor="test-user">
        Test user
        <AppSelect
          id="test-user"
          value={selectedUserId}
          onChange={setSelectedUserId}
          disabled={submitting}
          options={users.map((user) => ({ value: user.userId, label: userOptionLabel(user) }))}
        />
      </label>
      <button
        type="submit"
        className="btn test-login-button"
        disabled={!selectedUserId || submitting}
      >
        {submitting ? 'Signing in...' : 'Sign in as test user'}
      </button>
      {error ? <p className="test-login-error">{error}</p> : null}
    </form>
  )
}
