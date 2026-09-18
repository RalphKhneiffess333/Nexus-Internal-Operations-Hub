import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditAction, Prisma, TicketEventAction, TicketStatus, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { SessionService } from '../authentication/sessions/session.service';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { AuditQueryDto, CreateAdminUserDto, CreateDepartmentDto, PageQueryDto, UpdateConfigurationDto, UpdateDepartmentDto, UpdateRoleDto, UpdateStatusDto } from './dto/admin.dto';

const supportedConfiguration = new Map([
  ['REMINDER_INTERVAL_LOW_MINUTES', 'Reminder interval for LOW tickets in minutes'],
  ['REMINDER_INTERVAL_MODERATE_MINUTES', 'Reminder interval for MODERATE tickets in minutes'],
  ['REMINDER_INTERVAL_HIGH_MINUTES', 'Reminder interval for HIGH tickets in minutes'],
]);

@Injectable()
export class AdministrationService {
  constructor(private readonly prisma: PrismaService, private readonly sessions: SessionService) {}

  async listUsers(query: PageQueryDto) {
    const where: Prisma.UserWhereInput = query.search ? { OR: [{ email: { contains: query.search, mode: 'insensitive' } }, { fullName: { contains: query.search, mode: 'insensitive' } }] } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, orderBy: { fullName: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { departmentMembers: { include: { department: true } } } }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map((user) => this.safeUser(user)), page: query.page, pageSize: query.pageSize, total };
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { userId }, include: { departmentMembers: { include: { department: true } } } });
    if (!user) throw new NotFoundException('User was not found');
    return this.safeUser(user);
  }

  async createUser(dto: CreateAdminUserDto, actor: AuthenticatedRequestUser) {
    const provider = await this.prisma.identityProvider.findFirst({ where: { code: 'MICROSOFT_ENTRA_ID', active: true } });
    if (!provider) throw new BadRequestException('No active identity provider is configured');
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { userId: randomUUID(), email: dto.email.trim().toLowerCase(), fullName: dto.fullName.trim(), phoneNumber: dto.phoneNumber?.trim() ?? null, role: dto.role, isActive: true, hasLogged: false, identityProviderId: provider.identityProviderId, identityProviderUserId: null } });
      await this.audit(tx, actor.userId, AuditAction.USER_PREPROVISIONING, { userId: created.userId, email: created.email, role: created.role });
      return created;
    }).catch((error) => this.mapConflict(error));
    return this.safeUser(user);
  }

  async changeRole(userId: string, dto: UpdateRoleDto, actor: AuthenticatedRequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { userId } });
      if (!user) throw new NotFoundException('User was not found');
      if (user.role === dto.role) return this.safeUser(user);
      if (user.role === UserRole.Admin && dto.role !== UserRole.Admin) await this.assertNotLastAdmin(tx, userId);
      const updated = await tx.user.update({ where: { userId }, data: { role: dto.role } });
      if (dto.role === UserRole.Employee) await this.reconcileMemberships(tx, userId, actor.userId);
      await this.audit(tx, actor.userId, AuditAction.ROLE_MAPPING, { userId, beforeRole: user.role, afterRole: dto.role });
      return this.safeUser(updated);
    });
  }

  async changeStatus(userId: string, dto: UpdateStatusDto, actor: AuthenticatedRequestUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { userId } });
      if (!user) throw new NotFoundException('User was not found');
      if (user.isActive === dto.active) return user;
      if (user.role === UserRole.Admin && !dto.active) await this.assertNotLastAdmin(tx, userId);
      const updated = await tx.user.update({ where: { userId }, data: { isActive: dto.active } });
      if (!dto.active) await this.reconcileMemberships(tx, userId, actor.userId);
      await this.audit(tx, actor.userId, dto.active ? AuditAction.USER_ACTIVATION : AuditAction.USER_DEACTIVATION, { userId, beforeActive: user.isActive, afterActive: dto.active });
      return updated;
    });
    if (!dto.active) this.sessions.deleteSessionsForUser(userId);
    return this.getUser(result.userId);
  }

  async listDepartments(query: PageQueryDto) {
    const where: Prisma.DepartmentWhereInput = query.search ? { OR: [{ code: { contains: query.search, mode: 'insensitive' } }, { name: { contains: query.search, mode: 'insensitive' } }] } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({ where, orderBy: { name: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { _count: { select: { members: true, tickets: true } } } }),
      this.prisma.department.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async createDepartment(dto: CreateDepartmentDto, actor: AuthenticatedRequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const department = await tx.department.create({ data: { departmentId: randomUUID(), code: dto.code.trim().toUpperCase(), name: dto.name.trim(), desc: dto.description.trim(), active: true } });
      await this.audit(tx, actor.userId, AuditAction.DEPARTMENT_ADDITION, { departmentId: department.departmentId, code: department.code, name: department.name });
      return department;
    }).catch((error) => this.mapConflict(error));
  }

  async updateDepartment(departmentId: string, dto: UpdateDepartmentDto, actor: AuthenticatedRequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.department.findUnique({ where: { departmentId } });
      if (!before) throw new NotFoundException('Department was not found');
      const after = await tx.department.update({ where: { departmentId }, data: { ...(dto.code === undefined ? {} : { code: dto.code.trim().toUpperCase() }), ...(dto.name === undefined ? {} : { name: dto.name.trim() }), ...(dto.description === undefined ? {} : { desc: dto.description.trim() }) } });
      await this.audit(tx, actor.userId, AuditAction.DEPARTMENT_MODIFICATION, { departmentId, before: { code: before.code, name: before.name, description: before.desc }, after: { code: after.code, name: after.name, description: after.desc } });
      return after;
    }).catch((error) => this.mapConflict(error));
  }

  async setDepartmentActive(departmentId: string, active: boolean, actor: AuthenticatedRequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const department = await tx.department.findUnique({ where: { departmentId }, include: { tickets: { where: { active: true }, select: { ticketId: true }, take: 1 } } });
      if (!department) throw new NotFoundException('Department was not found');
      if (department.active === active) return department;
      if (!active && department.tickets.length > 0) throw new ConflictException('Department has active tickets and cannot be deactivated');
      const updated = await tx.department.update({ where: { departmentId }, data: { active } });
      await this.audit(tx, actor.userId, active ? AuditAction.DEPARTMENT_REACTIVATION : AuditAction.DEPARTMENT_DELETION, { departmentId, beforeActive: department.active, afterActive: active });
      return updated;
    });
  }

  async listMembers(departmentId: string) {
    const department = await this.prisma.department.findUnique({ where: { departmentId } });
    if (!department) throw new NotFoundException('Department was not found');
    const members = await this.prisma.departmentMember.findMany({ where: { departmentId }, include: { user: true }, orderBy: { user: { fullName: 'asc' } } });
    return members.map(({ user }) => this.safeUser(user));
  }

  async addMembership(userId: string, departmentId: string, actor: AuthenticatedRequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const [user, department] = await Promise.all([tx.user.findUnique({ where: { userId } }), tx.department.findUnique({ where: { departmentId } })]);
      if (!user) throw new NotFoundException('User was not found');
      if (!department) throw new NotFoundException('Department was not found');
      if (user.role === UserRole.Employee) throw new BadRequestException('Only agents and administrators can belong to departments');
      if (!department.active) throw new BadRequestException('Inactive departments cannot accept members');
      const membership = await tx.departmentMember.upsert({ where: { userId_departmentId: { userId, departmentId } }, create: { departmentMemberId: randomUUID(), userId, departmentId }, update: {} });
      await this.audit(tx, actor.userId, AuditAction.DEPARTMENT_MAPPING, { userId, departmentId, mapping: 'ADDED' });
      return membership;
    });
  }

  async removeMembership(userId: string, departmentId: string, actor: AuthenticatedRequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.departmentMember.findUnique({ where: { userId_departmentId: { userId, departmentId } } });
      if (!membership) throw new NotFoundException('Department membership was not found');
      await this.reconcileMembership(tx, userId, departmentId, actor.userId);
      await tx.departmentMember.delete({ where: { userId_departmentId: { userId, departmentId } } });
      await this.audit(tx, actor.userId, AuditAction.DEPARTMENT_MAPPING, { userId, departmentId, mapping: 'REMOVED' });
      return { removed: true };
    });
  }

  async listConfigurations() {
    return this.prisma.systemConfiguration.findMany({ where: { key: { in: [...supportedConfiguration.keys()] } }, orderBy: { key: 'asc' } });
  }

  async updateConfiguration(key: string, dto: UpdateConfigurationDto, actor: AuthenticatedRequestUser) {
    if (!supportedConfiguration.has(key)) throw new NotFoundException('Configuration key was not found');
    if (!/^\d+$/.test(dto.value) || Number(dto.value) < 0) throw new BadRequestException('Configuration value must be a non-negative integer');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.systemConfiguration.findUnique({ where: { key } });
      if (!current) throw new NotFoundException('Configuration key was not found');
      const updated = await tx.systemConfiguration.update({ where: { key }, data: { value: dto.value } });
      await this.audit(tx, actor.userId, AuditAction.SYSTEM_VARIABLE_MODIFICATION, { key, oldValue: current.value, newValue: updated.value });
      return updated;
    });
  }

  async listAuditLogs(query: AuditQueryDto) {
    const where: Prisma.AuditLogWhereInput = { ...(query.action ? { action: query.action as AuditAction } : {}), ...(query.actorId ? { actorId: query.actorId } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, include: { actor: { select: { userId: true, fullName: true, email: true } } }, orderBy: [{ createdAt: 'desc' }, { auditLogId: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getAuditLog(auditLogId: string) {
    const log = await this.prisma.auditLog.findUnique({ where: { auditLogId }, include: { actor: { select: { userId: true, fullName: true, email: true } } } });
    if (!log) throw new NotFoundException('Audit log was not found');
    return log;
  }

  private async reconcileMembership(tx: Prisma.TransactionClient, userId: string, departmentId: string, actorId: string) {
    const tickets = await tx.ticket.findMany({ where: { departmentId, agentId: userId, active: true, status: TicketStatus.CLAIMED } });
    for (const ticket of tickets) {
      const now = new Date();
      await tx.ticket.update({ where: { ticketId: ticket.ticketId }, data: { status: TicketStatus.CLOSED, agentId: null, completionNotes: 'This agent was removed from the department.', closedAt: now, updatedAt: now } });
      await tx.ticketEvent.create({ data: { ticketEventId: randomUUID(), ticketId: ticket.ticketId, userId: actorId, action: TicketEventAction.CLOSE, details: { agentId: userId, completionNotes: 'This agent was removed from the department.' }, createdAt: now, updatedAt: now } });
    }
  }

  private async reconcileMemberships(tx: Prisma.TransactionClient, userId: string, actorId: string) {
    const memberships = await tx.departmentMember.findMany({ where: { userId } });
    for (const membership of memberships) await this.reconcileMembership(tx, userId, membership.departmentId, actorId);
    if (memberships.length) await tx.departmentMember.deleteMany({ where: { userId } });
  }

  private async assertNotLastAdmin(tx: Prisma.TransactionClient, userId: string) {
    const admins = await tx.user.count({ where: { role: UserRole.Admin, isActive: true, NOT: { userId } } });
    if (admins === 0) throw new ConflictException('The last active administrator cannot be removed');
  }

  private async audit(tx: Prisma.TransactionClient, actorId: string, action: AuditAction, details: Prisma.InputJsonValue) {
    await tx.auditLog.create({ data: { auditLogId: randomUUID(), actorId, action, details } });
  }

  private safeUser(user: any) {
    const { identityProviderId, identityProviderUserId, departmentMembers, ...safe } = user;
    return { ...safe, departments: departmentMembers?.map((membership: any) => membership.department) ?? [] };
  }

  private mapConflict(error: unknown): never {
    if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof BadRequestException) throw error;
    if ((error as { code?: string })?.code === 'P2002') throw new ConflictException('A record with the same unique value already exists');
    throw error;
  }
}
