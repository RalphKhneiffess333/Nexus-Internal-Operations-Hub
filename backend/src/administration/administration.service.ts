import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { AuditService } from '../audit/audit.service';
import { ADMINISTRATION_DEPARTMENT_CODE } from '../departments/department.constants';
import {
  AdministrationRepository,
  DepartmentListRecord,
} from './administration.repository';
import {
  CreateDepartmentDto,
  PageQueryDto,
  UpdateDepartmentDto,
} from './dto/admin.dto';
import { CreatePriorityDto, UpdatePriorityDto } from './dto/priority.dto';
import { PrioritiesRepository } from '../priorities/priorities.repository';
import { filterOptionsChangedEvent } from '../filters/filter-options-events';
import { RealtimeInternalEvent } from '../realtime/realtime-events';

@Injectable()
export class AdministrationService {
  constructor(
    private readonly administrationRepository: AdministrationRepository,
    private readonly auditService: AuditService,
    private readonly prioritiesRepository: PrioritiesRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listDepartments(query: PageQueryDto) {
    const result = await this.administrationRepository.listDepartments(
      query.search,
      (query.page - 1) * query.pageSize,
      query.pageSize,
      ADMINISTRATION_DEPARTMENT_CODE,
    );
    return {
      items: result.items.map((item) => this.toDepartmentResponse(item)),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    };
  }

  async createDepartment(
    dto: CreateDepartmentDto,
    actor: AuthenticatedRequestUser,
  ) {
    const result = await this.administrationRepository
      .transaction(async (tx) => {
        const code = dto.code.trim().toUpperCase();
        if (code === ADMINISTRATION_DEPARTMENT_CODE)
          throw new BadRequestException(
            'The Administration department is reserved by the system',
          );
        const department = await this.administrationRepository.createDepartment(
          code,
          dto.name.trim(),
          dto.description.trim(),
          tx,
        );
        await this.auditService.append(
          tx,
          actor.userId,
          AuditAction.DEPARTMENT_ADDITION,
          {
            departmentId: department.departmentId,
            code: department.code,
            name: department.name,
          },
        );
        return this.toDepartmentResponse(department);
      })
      .catch((error) => this.mapConflict(error));
    this.publishFilterOptionsChanged(actor.userId);
    return result;
  }

  async updateDepartment(
    departmentId: string,
    dto: UpdateDepartmentDto,
    actor: AuthenticatedRequestUser,
  ) {
    const result = await this.administrationRepository
      .transaction(async (tx) => {
        const before = await this.administrationRepository.findDepartment(
          departmentId,
          tx,
        );
        if (!before) throw new NotFoundException('Department was not found');
        if (before.code === ADMINISTRATION_DEPARTMENT_CODE)
          throw new BadRequestException(
            'The Administration department is reserved by the system',
          );
        const after = await this.administrationRepository.updateDepartment(
          departmentId,
          {
            ...(dto.code === undefined
              ? {}
              : { code: dto.code.trim().toUpperCase() }),
            ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
            ...(dto.description === undefined
              ? {}
              : { description: dto.description.trim() }),
          },
          tx,
        );
        await this.auditService.append(
          tx,
          actor.userId,
          AuditAction.DEPARTMENT_MODIFICATION,
          {
            departmentId,
            before: {
              code: before.code,
              name: before.name,
              description: before.desc,
            },
            after: {
              code: after.code,
              name: after.name,
              description: after.desc,
            },
          },
        );
        return this.toDepartmentResponse(after);
      })
      .catch((error) => this.mapConflict(error));
    this.publishFilterOptionsChanged(actor.userId);
    return result;
  }

  async setDepartmentActive(
    departmentId: string,
    active: boolean,
    actor: AuthenticatedRequestUser,
  ) {
    const result = await this.administrationRepository.transaction(async (tx) => {
      const department =
        await this.administrationRepository.findDepartmentWithActiveTicket(
          departmentId,
          tx,
        );
      if (!department) throw new NotFoundException('Department was not found');
      if (department.code === ADMINISTRATION_DEPARTMENT_CODE)
        throw new BadRequestException(
          'The Administration department cannot be deactivated',
        );
      if (department.active === active) return department;
      if (!active && department.tickets.length > 0)
        throw new ConflictException(
          'Department has active tickets and cannot be deactivated',
        );
      const updated = await this.administrationRepository.setDepartmentActive(
        departmentId,
        active,
        tx,
      );
      await this.auditService.append(
        tx,
        actor.userId,
        active
          ? AuditAction.DEPARTMENT_REACTIVATION
          : AuditAction.DEPARTMENT_DELETION,
        { departmentId, beforeActive: department.active, afterActive: active },
      );
      return this.toDepartmentResponse(updated);
    });
    this.publishFilterOptionsChanged(actor.userId);
    return result;
  }

  async listMembersPage(departmentId: string, query: PageQueryDto) {
    const department = await this.administrationRepository.findDepartment(
      departmentId,
    );
    if (!department) throw new NotFoundException('Department was not found');
    const result = await this.administrationRepository.listMembers(
      departmentId,
      query.search,
      (query.page - 1) * query.pageSize,
      query.pageSize,
    );
    return {
      items: result.items.map(({ user }) => this.toMemberResponse(user)),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    };
  }

  listPriorities() {
    return this.prioritiesRepository.list(false);
  }

  async createPriority(
    dto: CreatePriorityDto,
    actor: AuthenticatedRequestUser,
  ) {
    const result = await this.administrationRepository
      .transaction(async (tx) => {
        const priority = await this.prioritiesRepository.create(
          {
            code: dto.code.trim().toUpperCase(),
            name: dto.name.trim(),
            reminderIntervalMinutes: dto.reminderIntervalMinutes,
          },
          tx,
        );
        await this.auditService.append(
          tx,
          actor.userId,
          AuditAction.PRIORITY_ADDITION,
          {
            priorityId: priority.priorityId,
            code: priority.code,
            name: priority.name,
            reminderIntervalMinutes: priority.reminderIntervalMinutes,
          },
        );
        return priority;
      })
      .catch((error) => this.mapConflict(error));
    this.publishFilterOptionsChanged(actor.userId);
    return result;
  }

  async updatePriority(
    priorityId: string,
    dto: UpdatePriorityDto,
    actor: AuthenticatedRequestUser,
  ) {
    const result = await this.administrationRepository.transaction(async (tx) => {
      const before = await this.prioritiesRepository.findById(priorityId, tx);
      if (!before) throw new NotFoundException('Priority was not found');
      const after = await this.prioritiesRepository.update(
        priorityId,
        {
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          ...(dto.reminderIntervalMinutes === undefined
            ? {}
            : { reminderIntervalMinutes: dto.reminderIntervalMinutes }),
        },
        tx,
      );
      await this.auditService.append(
        tx,
        actor.userId,
        AuditAction.PRIORITY_MODIFICATION,
        {
          priorityId,
          before: {
            name: before.name,
            reminderIntervalMinutes: before.reminderIntervalMinutes,
          },
          after: {
            name: after.name,
            reminderIntervalMinutes: after.reminderIntervalMinutes,
          },
        },
      );
      return after;
    });
    this.publishFilterOptionsChanged(actor.userId);
    return result;
  }

  async setPriorityActive(
    priorityId: string,
    active: boolean,
    actor: AuthenticatedRequestUser,
  ) {
    const result = await this.administrationRepository.transaction(async (tx) => {
      const before = await this.prioritiesRepository.findById(priorityId, tx);
      if (!before) throw new NotFoundException('Priority was not found');
      if (before.active === active) return before;
      if (!active && (await this.prioritiesRepository.countActive(tx)) <= 1) {
        throw new ConflictException('At least one priority must remain active');
      }
      const after = await this.prioritiesRepository.setActive(
        priorityId,
        active,
        tx,
      );
      await this.auditService.append(
        tx,
        actor.userId,
        active
          ? AuditAction.PRIORITY_REACTIVATION
          : AuditAction.PRIORITY_DELETION,
        { priorityId, code: before.code, beforeActive: before.active, afterActive: active },
      );
      return after;
    });
    this.publishFilterOptionsChanged(actor.userId);
    return result;
  }

  private toMemberResponse(user: {
    userId: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
  }) {
    return {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    };
  }

  private publishFilterOptionsChanged(actorId: string): void {
    this.eventEmitter.emit(
      RealtimeInternalEvent.FilterOptionsChanged,
      filterOptionsChangedEvent(actorId),
    );
  }

  private toDepartmentResponse(
    department: DepartmentListRecord | {
      departmentId: string;
      code: string;
      name: string;
      desc: string;
      active: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
  ) {
    return {
      departmentId: department.departmentId,
      code: department.code,
      name: department.name,
      desc: department.desc,
      active: department.active,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
      ...('_count' in department ? { _count: department._count } : {}),
    };
  }

  private mapConflict(error: unknown): never {
    if (
      error instanceof ConflictException ||
      error instanceof NotFoundException ||
      error instanceof BadRequestException
    )
      throw error;
    if ((error as { code?: string })?.code === 'P2002')
      throw new ConflictException(
        'A record with the same unique value already exists',
      );
    throw error;
  }
}
