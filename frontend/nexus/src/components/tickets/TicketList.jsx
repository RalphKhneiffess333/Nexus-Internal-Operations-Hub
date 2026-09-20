import { TicketListItem } from './TicketListItem'

export function TicketList({ tickets, departments = [], priorities = [] }) {
  return (
    <ul className="ticket-list content-reveal">
      {tickets.map((ticket) => (
        <li key={ticket.ticketId}>
          <TicketListItem ticket={ticket} departments={departments} priorities={priorities} />
        </li>
      ))}
    </ul>
  )
}
