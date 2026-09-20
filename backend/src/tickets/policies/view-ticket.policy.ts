import { ForbiddenException, Injectable } from '@nestjs/common';
import { Ticket, UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';

@Injectable()
export class ViewTicketPolicy {
  canView(
    actor: AuthenticatedRequestUser,
    ticket: Pick<Ticket, 'submittedBy' | 'departmentId'>,
    actorDepartmentIds: string[],
  ): boolean {
    if (actor.role === UserRole.Admin) {
      return true;
    }

    if (ticket.submittedBy === actor.userId) {
      return true;
    }

    return (
      actor.role === UserRole.Agent &&
      actorDepartmentIds.includes(ticket.departmentId)
    );
  }

  assert(
    actor: AuthenticatedRequestUser,
    ticket: Pick<Ticket, 'submittedBy' | 'departmentId'>,
    actorDepartmentIds: string[],
  ): void {
    if (!this.canView(actor, ticket, actorDepartmentIds)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
  }
}
