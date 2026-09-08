import { Injectable, NotFoundException } from '@nestjs/common';
import { Department } from '../../departments/entities/department.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class SubmitTicketPolicy {
  assert(submitter: User | undefined, department: Department | undefined): void {
    if (!submitter) {
      throw new NotFoundException('User was not found');
    }

    if (!department || !department.active) {
      throw new NotFoundException('Department was not found');
    }
  }
}
