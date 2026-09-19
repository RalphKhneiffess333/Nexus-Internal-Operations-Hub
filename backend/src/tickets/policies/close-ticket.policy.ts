import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Ticket, TicketStatus, UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';

@Injectable()
export class CloseTicketPolicy {
  assert(ticket: Ticket, actor: AuthenticatedRequestUser): void {
    if (!ticket.active) {
      throw new BadRequestException('Inactive tickets cannot be closed');
    }

    if (ticket.status !== TicketStatus.CLAIMED) {
      throw new BadRequestException(
        'A ticket can only be closed when its status is CLAIMED',
      );
    }

    if (ticket.agentId === null) {
      throw new BadRequestException(
        'A CLAIMED ticket must have exactly one assigned agent',
      );
    }

    if (ticket.agentId !== actor.userId && actor.role !== UserRole.Admin) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
  }
}
