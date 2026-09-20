import { useCallback, useEffect, useState } from 'react'
import { getDepartments } from './department-api'
import { useLatestRequest } from '../../lib/api/use-latest-request'

const departmentCache = new Map()
const departmentRequests = new Map()

async function loadDepartmentReference(scope, force = false) {
  if (!force && departmentCache.has(scope)) {
    return departmentCache.get(scope)
  }

  if (!force && departmentRequests.has(scope)) {
    return departmentRequests.get(scope)
  }

  const request = getDepartments({ scope })
    .then((result) => {
      const departments = Array.isArray(result) ? result : []
      departmentCache.set(scope, departments)
      return departments
    })
    .finally(() => departmentRequests.delete(scope))

  departmentRequests.set(scope, request)
  return request
}

export function useDepartments(scope = 'all') {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { beginRequest } = useLatestRequest()

  const loadDepartments = useCallback(async () => {
    const request = beginRequest()
    setLoading(true)
    setError('')
    try {
      const result = await loadDepartmentReference(scope, true)
      if (!request.isCurrent()) return
      setDepartments(result)
    } catch (loadError) {
      if (!request.isCurrent()) return
      setError(loadError.message || 'Unable to load departments. Please try again.')
      setDepartments([])
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [beginRequest, scope])

  useEffect(() => {
    const request = beginRequest()

    async function loadInitialDepartments() {
      try {
        const result = await loadDepartmentReference(scope)
        if (request.isCurrent()) {
          setDepartments(result)
        }
      } catch (loadError) {
        if (request.isCurrent()) {
          setError(
            loadError.message ||
              'Unable to load departments. Please try again.',
          )
          setDepartments([])
        }
      } finally {
        if (request.isCurrent()) {
          setLoading(false)
        }
      }
    }

    void loadInitialDepartments()
  }, [beginRequest, scope])

  return { departments, loading, error, reload: loadDepartments }
}

export function departmentLabel(departmentId, departments = []) {
  return (
    departments.find((department) => department.departmentId === departmentId)?.name ??
    departmentId
  )
}
