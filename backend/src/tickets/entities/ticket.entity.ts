import { TicketPriority } from '../../common/enums/ticket-priority.enum';
import { TicketStatus } from '../../common/enums/ticket-status.enum';

export class Ticket {
  ticketId!: string;
  ticketCode!: string;
  title!: string;
  description!: string;
  priority!: TicketPriority;
  status!: TicketStatus;
  departmentId!: string;
  submittedBy!: string;
  agentId!: string | null;
  active!: boolean;
  completionNotes!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  closedAt!: Date | null;
}
