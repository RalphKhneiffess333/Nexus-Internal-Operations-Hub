import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Department } from '../../departments/entities/department.entity';
import { TicketStatus } from '../../common/enums/ticket-status.enum';
import { ModifyTicketDto } from '../dto/modify-ticket.dto';
import { Ticket } from '../entities/ticket.entity';

@Injectable()
export class ModifyTicketPolicy {
  assert(
    ticket: Ticket,
    dto: ModifyTicketDto,
    department: Department | undefined,
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
