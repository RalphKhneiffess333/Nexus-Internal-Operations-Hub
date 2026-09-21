import { Injectable } from '@nestjs/common';
import { HandoffStatus, TicketStatus, UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsService } from '../departments/departments.service';
import { HandoffsService } from '../tickets/handoffs/handoffs.service';
import { PrioritiesService } from '../priorities/priorities.service';
import type { FilterOptionsPayload } from './filter-options.types';

@Injectable()
export class FilterOptionsService {
  constructor(
    private readonly departmentsService: DepartmentsService,
    private readonly prioritiesService: PrioritiesService,
    private readonly handoffsService: HandoffsService,
  ) {}

  async listForUser(actor: AuthenticatedRequestUser): Promise<FilterOptionsPayload> {
    const canViewHandoffs = actor.role === UserRole.Agent || actor.role === UserRole.Admin;
    const [departments, myDepartments, priorities, handoffParticipants] = await Promise.all([
      this.departmentsService.findAll(actor, 'all'),
      this.departmentsService.findAll(actor, 'mine'),
      this.prioritiesService.list(true),
      canViewHandoffs ? this.handoffsService.listParticipants(actor) : Promise.resolve([]),
    ]);

    return {
      departments,
      myDepartments,
      priorities,
      ticketStatuses: Object.values(TicketStatus),
      handoffStatuses: Object.values(HandoffStatus),
      handoffParticipants,
    };
  }
}
