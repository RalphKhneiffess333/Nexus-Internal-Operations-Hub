import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Department, UserRole } from '@prisma/client';
import { ADMINISTRATION_DEPARTMENT_CODE } from '../../departments/department.constants';

@Injectable()
export class SubmitTicketPolicy {
  assert(department: Department | null, actorRole: UserRole): void {
    if (!department || !department.active) {
      throw new NotFoundException('Department was not found');
    }
    if (
      department.code === ADMINISTRATION_DEPARTMENT_CODE &&
      actorRole === UserRole.Employee
    ) {
      throw new ForbiddenException(
        'Employees cannot submit tickets to the Administration department',
      );
    }
  }
}
