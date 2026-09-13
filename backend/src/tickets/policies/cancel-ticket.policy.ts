import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Ticket, TicketStatus } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';

@Injectable()
export class CancelTicketPolicy {
  assert(ticket: Ticket, actor: AuthenticatedRequestUser): void {
    if (!ticket.active) {
      throw new BadRequestException('Ticket is already cancelled');
    }

    if (ticket.status !== TicketStatus.OPEN) {
      throw new BadRequestException(
        'A ticket can only be cancelled when its status is OPEN',
      );
    }

    if (ticket.agentId !== null) {
      throw new BadRequestException(
        'An OPEN ticket must not have an assigned agent',
      );
    }

    if (ticket.submittedBy !== actor.userId) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
  }
}
