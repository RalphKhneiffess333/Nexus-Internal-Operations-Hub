import { LoadingState } from '../../components/ui/LoadingState'
import { ManagementTabs } from '../../components/administration/ManagementTabs'
import { DepartmentsSection } from '../../components/administration/DepartmentsSection'
import { PrioritiesSection } from '../../components/administration/PrioritiesSection'
import { UsersSection } from '../../components/administration/UsersSection'
import { useManagementController } from '../../features/administration/use-management-controller'

export function ManagementPage() {
  const management = useManagementController()
  const { actions } = management

  return (
    <section className="page administration-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Management</h1>
          <p className="page-description">
            Manage Nexus accounts, departments, and supported operational settings.
          </p>
        </div>
      </header>

      {management.error ? <div className="banner error"><p>{management.error}</p><button type="button" className="btn ghost" onClick={actions.reload}>Try again</button></div> : null}
      {management.notice ? <p className="banner success">{management.notice}</p> : null}

      <ManagementTabs section={management.section} onChange={actions.updateSection} />

      {management.loading ? <LoadingState>Loading management data...</LoadingState> : null}
      {management.section === 'users' ? <UsersSection model={management.users} actions={actions} loading={management.loading} /> : null}
      {management.section === 'departments' ? <DepartmentsSection model={management.departments} actions={actions} loading={management.loading} /> : null}
      {management.section === 'priorities' ? <PrioritiesSection model={management.priorities} actions={actions} /> : null}
    </section>
  )
}
