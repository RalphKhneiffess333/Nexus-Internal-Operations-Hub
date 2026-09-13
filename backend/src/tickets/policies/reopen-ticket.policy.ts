import { BadRequestException, Injectable } from '@nestjs/common';
import { Ticket, TicketStatus } from '@prisma/client';

@Injectable()
export class ReopenTicketPolicy {
  assert(ticket: Ticket): void {
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
  }
}
