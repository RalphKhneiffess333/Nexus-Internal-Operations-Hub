import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TicketStatus } from '../../common/enums/ticket-status.enum';
import { User } from '../../users/entities/user.entity';
import { Ticket } from '../entities/ticket.entity';

@Injectable()
export class ClaimTicketPolicy {
  assert(ticket: Ticket, agent: User | undefined): void {
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

    if (!agent) {
      throw new NotFoundException('User was not found');
    }
  }
}
