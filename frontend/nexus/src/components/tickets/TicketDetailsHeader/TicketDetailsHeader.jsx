import { Link } from 'react-router-dom'
import { TicketActionControls } from '../TicketActionControls/TicketActionControls'

export function TicketDetailsHeader({
  backPath,
  backLabel,
  ticket,
  editing,
  permissions,
  adminClosingAnotherAgentTicket,
  onEdit,
  actions,
}) {
  return (
    <header className="page-header">
      <div>
        <Link to={backPath} className="back-link">← {backLabel}</Link>
        <h1>Ticket details</h1>
        <p className="page-description">Review the request, follow its progress, and take the next action.</p>
      </div>
      {ticket ? (
        <TicketActionControls
          ticket={ticket}
          editing={editing}
          permissions={permissions}
          adminClosingAnotherAgentTicket={adminClosingAnotherAgentTicket}
          onEdit={onEdit}
          actions={actions}
        />
      ) : null}
    </header>
  )
}


