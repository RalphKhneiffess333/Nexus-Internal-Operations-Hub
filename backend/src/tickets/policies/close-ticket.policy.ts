import { BadRequestException, Injectable } from '@nestjs/common';
import { TicketStatus } from '../../common/enums/ticket-status.enum';
import { Ticket } from '../entities/ticket.entity';

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
