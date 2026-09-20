import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getUser } from '../../../features/users/users-api'
import { UserDetailsDialog } from '../UserDetailsDialog/UserDetailsDialog'

export function UserLink({ user, className = '' }) {
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  if (!user) return null

  async function openDetails(event) {
    event.preventDefault()
    event.stopPropagation()
    if (loading) return

    const currentRequestId = requestId.current + 1
    requestId.current = currentRequestId
    setError('')
    if (!user.userId) {
      setDetails(user)
      return
    }

    setLoading(true)
    try {
      const result = await getUser(user.userId)
      if (requestId.current === currentRequestId) setDetails(result)
    } catch (loadError) {
      if (requestId.current === currentRequestId) {
        setDetails(user)
        setError(loadError.message || 'Unable to load the complete user profile.')
      }
    } finally {
      if (requestId.current === currentRequestId) setLoading(false)
    }
  }

  function closeDetails() {
    requestId.current += 1
    setDetails(null)
    setError('')
    setLoading(false)
  }

  function stopParentNavigation(event) {
    event.stopPropagation()
  }

  return (
    <>
      <button
        type="button"
        className={`user-reference-link ${className}`.trim()}
        data-prevent-ticket-navigation="true"
        onPointerDown={stopParentNavigation}
        onMouseDown={stopParentNavigation}
        onKeyDown={stopParentNavigation}
        onClick={(event) => void openDetails(event)}
        aria-label={`View details for ${user.fullName || 'user'}`}
      >
        {user.fullName || 'Unknown user'}
      </button>
      {details
        ? createPortal(
            <UserDetailsDialog
              user={details}
              error={error}
              loading={loading}
              onClose={closeDetails}
            />,
            document.body,
          )
        : null}
    </>
  )
}


