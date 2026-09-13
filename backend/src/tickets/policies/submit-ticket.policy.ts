import { Injectable, NotFoundException } from '@nestjs/common';
import { Department } from '@prisma/client';

@Injectable()
export class SubmitTicketPolicy {
  assert(department: Department | null): void {
    if (!department || !department.active) {
      throw new NotFoundException('Department was not found');
    }
  }
}
