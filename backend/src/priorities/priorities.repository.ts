import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mapPrismaError } from '../database/prisma-error';
import { PrismaService } from '../database/prisma.service';

export type PriorityPersistenceClient =
  | PrismaService
  | Prisma.TransactionClient;

const prioritySelect = {
  priorityId: true,
  code: true,
  name: true,
  reminderIntervalMinutes: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PrioritySelect;

export type PriorityRecord = Prisma.PriorityGetPayload<{
  select: typeof prioritySelect;
}>;

@Injectable()
export class PrioritiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async transaction<T>(
    operation: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async list(activeOnly = false): Promise<PriorityRecord[]> {
    try {
      return await this.prisma.priority.findMany({
        where: activeOnly ? { active: true } : undefined,
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        select: prioritySelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findById(
    priorityId: string,
    client: PriorityPersistenceClient = this.prisma,
  ): Promise<PriorityRecord | null> {
    try {
      return await client.priority.findUnique({
        where: { priorityId },
        select: prioritySelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByCode(
    code: string,
    client: PriorityPersistenceClient = this.prisma,
  ): Promise<PriorityRecord | null> {
    try {
      return await client.priority.findUnique({
        where: { code },
        select: prioritySelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findIntervals(codes: string[]) {
    if (codes.length === 0) return [];
    try {
      return await this.prisma.priority.findMany({
        where: { code: { in: codes }, active: true },
        select: { code: true, reminderIntervalMinutes: true },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async create(
    data: {
      code: string;
      name: string;
      reminderIntervalMinutes: number;
    },
    client: Prisma.TransactionClient,
  ): Promise<PriorityRecord> {
    try {
      return await client.priority.create({
        data: {
          priorityId: randomUUID(),
          code: data.code,
          name: data.name,
          reminderIntervalMinutes: data.reminderIntervalMinutes,
          active: true,
        },
        select: prioritySelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async update(
    priorityId: string,
    data: { name?: string; reminderIntervalMinutes?: number },
    client: Prisma.TransactionClient,
  ): Promise<PriorityRecord> {
    try {
      return await client.priority.update({
        where: { priorityId },
        data,
        select: prioritySelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async setActive(
    priorityId: string,
    active: boolean,
    client: Prisma.TransactionClient,
  ): Promise<PriorityRecord> {
    try {
      return await client.priority.update({
        where: { priorityId },
        data: { active },
        select: prioritySelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async countActive(client: Prisma.TransactionClient): Promise<number> {
    try {
      return await client.priority.count({ where: { active: true } });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
