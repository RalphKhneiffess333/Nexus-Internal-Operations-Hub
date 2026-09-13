import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Department, Ticket, TicketStatus } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { ModifyTicketDto } from '../dto/modify-ticket.dto';

@Injectable()
export class ModifyTicketPolicy {
  assert(
    ticket: Ticket,
    actor: AuthenticatedRequestUser,
    dto: ModifyTicketDto,
    department: Department | null,
  ): void {
    if (!ticket.active) {
      throw new BadRequestException('Inactive tickets cannot be modified');
    }

    if (ticket.status !== TicketStatus.OPEN) {
      throw new BadRequestException(
        'A ticket can only be modified when its status is OPEN',
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

    if (
      dto.title === undefined &&
      dto.description === undefined &&
      dto.priority === undefined &&
      dto.departmentId === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    if (dto.departmentId !== undefined && (!department || !department.active)) {
      throw new NotFoundException('Department was not found');
    }
  }
}
