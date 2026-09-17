import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Ticket, TicketStatus } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';

@Injectable()
export class ClaimTicketPolicy {
  assert(
    ticket: Ticket,
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ): void {
    if (!ticket.active) {
      throw new BadRequestException('Inactive tickets cannot be claimed');
    }

    if (
      ticket.status !== TicketStatus.OPEN &&
      ticket.status !== TicketStatus.REOPENED
    ) {
      throw new BadRequestException(
        `A ticket can only be claimed when its status is OPEN or REOPENED`,
      );
    }

    if (ticket.agentId !== null) {
      throw new BadRequestException(
        'A ticket cannot be claimed if it already has an assigned agent',
      );
    }

    if (!actorDepartmentIds.includes(ticket.departmentId)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
  }
}
