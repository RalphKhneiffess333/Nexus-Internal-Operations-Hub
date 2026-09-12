import { useCallback, useEffect, useState } from 'react'
import { getDepartments } from './department-api'

export function useDepartments() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDepartments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getDepartments()
      setDepartments(Array.isArray(result) ? result : [])
    } catch (loadError) {
      setError(loadError.message || 'Unable to load departments. Please try again.')
      setDepartments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  return { departments, loading, error, reload: loadDepartments }
}

export function departmentLabel(departmentId, departments = []) {
  return (
    departments.find((department) => department.departmentId === departmentId)?.name ??
    departmentId
  )
}
