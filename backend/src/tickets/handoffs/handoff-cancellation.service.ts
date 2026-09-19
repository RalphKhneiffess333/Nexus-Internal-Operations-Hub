import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HandoffsRepository } from './handoffs.repository';

@Injectable()
export class HandoffCancellationService {
  constructor(private readonly handoffsRepository: HandoffsRepository) {}

  async cancelPendingForTicket(
    ticketId: string,
    actorId: string,
    reason: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await this.handoffsRepository.lockTicket(ticketId, client);
    await this.handoffsRepository.cancelPendingForTicket(
      ticketId,
      actorId,
      reason,
      client,
    );
  }

  async cancelPendingForUserInDepartment(
    userId: string,
    departmentId: string,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const pending =
      await this.handoffsRepository.findPendingForUserInDepartment(
        userId,
        departmentId,
        client,
      );
    const ticketIds = [
      ...new Set(pending.map((handoff) => handoff.ticketId)),
    ].sort();

    for (const ticketId of ticketIds) {
      await this.cancelPendingForTicket(
        ticketId,
        actorId,
        'DEPARTMENT_MEMBERSHIP_CHANGED',
        client,
      );
    }
  }

  async cancelPendingForUser(
    userId: string,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const pending = await this.handoffsRepository.findPendingForUser(
      userId,
      client,
    );
    const ticketIds = [
      ...new Set(pending.map((handoff) => handoff.ticketId)),
    ].sort();

    for (const ticketId of ticketIds) {
      await this.cancelPendingForTicket(
        ticketId,
        actorId,
        'USER_ELIGIBILITY_CHANGED',
        client,
      );
    }
  }
}
