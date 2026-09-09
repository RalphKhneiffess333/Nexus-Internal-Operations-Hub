import { BadRequestException, Injectable } from '@nestjs/common';
import { Ticket, TicketStatus } from '@prisma/client';

@Injectable()
export class CloseTicketPolicy {
  assert(ticket: Ticket): void {
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
  }
}
