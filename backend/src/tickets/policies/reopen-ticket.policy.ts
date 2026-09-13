import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Ticket, TicketStatus } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';

@Injectable()
export class ReopenTicketPolicy {
  assert(ticket: Ticket, actor: AuthenticatedRequestUser): void {
    if (!ticket.active) {
      throw new BadRequestException('Inactive tickets cannot be reopened');
    }

    if (ticket.status !== TicketStatus.CLOSED) {
      throw new BadRequestException(
        'A ticket cannot be reopened unless its status is CLOSED',
      );
    }

    if (ticket.agentId !== null) {
      throw new BadRequestException(
        'A CLOSED ticket must not have an assigned agent',
      );
    }

    if (ticket.submittedBy !== actor.userId) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
  }
}
