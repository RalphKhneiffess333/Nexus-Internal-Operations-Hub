import { useFilterOptions } from '../filters/use-filter-options'

export function useDepartments(scope = 'all') {
  const { departments, myDepartments, loading, error, reload } = useFilterOptions()
  return {
    departments: scope === 'mine' ? myDepartments : departments,
    loading,
    error,
    reload,
  }
}

export function departmentLabel(departmentId, departments = []) {
  return (
    departments.find((department) => department.departmentId === departmentId)?.name ??
    departmentId
  )
}
