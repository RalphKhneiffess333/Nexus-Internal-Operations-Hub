import { BadRequestException, Injectable } from '@nestjs/common';
import { Ticket, TicketStatus } from '@prisma/client';

@Injectable()
export class CancelTicketPolicy {
  assert(ticket: Ticket): void {
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
  }
}
