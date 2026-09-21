import { useFilterOptions } from '../filters/use-filter-options'

export function usePriorities() {
  const { priorities, loading, error, reload } = useFilterOptions()
  return { priorities, loading, error, reload }
}

export function priorityLabel(code, priorities = []) {
  return priorities.find((priority) => priority.code === code)?.name ?? code
}
