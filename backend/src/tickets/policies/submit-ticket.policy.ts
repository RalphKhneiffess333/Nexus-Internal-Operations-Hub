import { Injectable, NotFoundException } from '@nestjs/common';
import { Department, User } from '@prisma/client';

@Injectable()
export class SubmitTicketPolicy {
  assert(submitter: User | null, department: Department | null): void {
    if (!submitter) {
      throw new NotFoundException('User was not found');
    }

    if (!department || !department.active) {
      throw new NotFoundException('Department was not found');
    }
  }
}
