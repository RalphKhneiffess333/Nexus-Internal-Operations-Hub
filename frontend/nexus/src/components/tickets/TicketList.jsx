import { TicketListItem } from './TicketListItem'

export function TicketList({ tickets }) {
  return (
    <ul className="ticket-list">
      {tickets.map((ticket) => (
        <li key={ticket.ticketId}>
          <TicketListItem ticket={ticket} />
        </li>
      ))}
    </ul>
  )
}
