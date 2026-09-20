import { managementSections } from '../../features/administration/use-management-query-state'

export function ManagementTabs({ section, onChange }) {
  return (
    <div className="pool-switcher" role="tablist" aria-label="Management sections">
      {managementSections.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={section === item.id}
          className={section === item.id ? 'is-active' : ''}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
