import { useContext } from 'react'
import { FilterOptionsContext } from './filter-options-context'

export function useFilterOptions() {
  const context = useContext(FilterOptionsContext)
  if (!context) {
    throw new Error('useFilterOptions must be used within FilterOptionsProvider')
  }
  return context
}
