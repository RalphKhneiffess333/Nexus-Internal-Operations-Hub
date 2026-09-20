import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export const managementSections = [
  { id: 'users', label: 'Users' },
  { id: 'departments', label: 'Departments' },
  { id: 'priorities', label: 'Priorities' },
]

export function useManagementQueryState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedSection = searchParams.get('section')
  const section = managementSections.some((item) => item.id === requestedSection)
    ? requestedSection
    : 'users'
  const parsedUserPage = Number(searchParams.get('userPage') ?? '1')
  const parsedDepartmentPage = Number(searchParams.get('departmentPage') ?? '1')

  const query = {
    section,
    userSearch: searchParams.get('userSearch') ?? '',
    userStatus: searchParams.get('userStatus') ?? '',
    userDepartmentId: searchParams.get('userDepartmentId') ?? '',
    userHasLogged: searchParams.get('userHasLogged') ?? '',
    userPage: Number.isInteger(parsedUserPage) && parsedUserPage > 0 ? parsedUserPage : 1,
    departmentSearch: searchParams.get('departmentSearch') ?? '',
    departmentPage: Number.isInteger(parsedDepartmentPage) && parsedDepartmentPage > 0
      ? parsedDepartmentPage
      : 1,
  }

  const updateSection = useCallback((nextSection) => {
    const nextParams = new URLSearchParams(searchParams)
    if (nextSection === 'users') nextParams.delete('section')
    else nextParams.set('section', nextSection)
    if (nextSection === 'users') nextParams.delete('userPage')
    if (nextSection === 'departments') nextParams.delete('departmentPage')
    setSearchParams(nextParams)
  }, [searchParams, setSearchParams])

  const updateUserFilter = useCallback((name, value) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('userPage')
    if (value) nextParams.set(name, value)
    else nextParams.delete(name)
    setSearchParams(nextParams, name === 'userSearch' ? { replace: true } : undefined)
  }, [searchParams, setSearchParams])

  const updateDepartmentFilter = useCallback((name, value) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('departmentPage')
    if (value) nextParams.set(name, value)
    else nextParams.delete(name)
    setSearchParams(nextParams, name === 'departmentSearch' ? { replace: true } : undefined)
  }, [searchParams, setSearchParams])

  const updateUserPage = useCallback((nextPage) => {
    const nextParams = new URLSearchParams(searchParams)
    if (nextPage > 1) nextParams.set('userPage', String(nextPage))
    else nextParams.delete('userPage')
    setSearchParams(nextParams)
  }, [searchParams, setSearchParams])

  const updateDepartmentPage = useCallback((nextPage) => {
    const nextParams = new URLSearchParams(searchParams)
    if (nextPage > 1) nextParams.set('departmentPage', String(nextPage))
    else nextParams.delete('departmentPage')
    setSearchParams(nextParams)
  }, [searchParams, setSearchParams])

  return {
    ...query,
    updateSection,
    updateUserFilter,
    updateDepartmentFilter,
    updateUserPage,
    updateDepartmentPage,
  }
}
