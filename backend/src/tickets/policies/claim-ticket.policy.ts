import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Ticket, TicketStatus, User } from '@prisma/client';

@Injectable()
export class ClaimTicketPolicy {
  assert(ticket: Ticket, agent: User | null): void {
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
