import { useCallback, useEffect, useState } from 'react'
import { getDepartments } from './department-api'

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

  const loadDepartments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDepartments(await loadDepartmentReference(scope, true))
    } catch (loadError) {
      setError(loadError.message || 'Unable to load departments. Please try again.')
      setDepartments([])
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    let active = true

    async function loadInitialDepartments() {
      try {
        const result = await loadDepartmentReference(scope)
        if (active) {
          setDepartments(result)
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError.message ||
              'Unable to load departments. Please try again.',
          )
          setDepartments([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadInitialDepartments()

    return () => {
      active = false
    }
  }, [scope])

  return { departments, loading, error, reload: loadDepartments }
}

export function departmentLabel(departmentId, departments = []) {
  return (
    departments.find((department) => department.departmentId === departmentId)?.name ??
    departmentId
  )
}
