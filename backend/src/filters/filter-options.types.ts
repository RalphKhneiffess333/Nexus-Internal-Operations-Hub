import { HandoffStatus, TicketStatus } from '@prisma/client';
import type { DepartmentResponse } from '../departments/departments.service';
import type { PriorityRecord } from '../priorities/priorities.repository';
import type { HandoffUserSummary } from '../tickets/handoffs/handoff-response.mapper';

export interface FilterOptionsPayload {
  departments: DepartmentResponse[];
  myDepartments: DepartmentResponse[];
  priorities: PriorityRecord[];
  ticketStatuses: TicketStatus[];
  handoffStatuses: HandoffStatus[];
  handoffParticipants: HandoffUserSummary[];
}
