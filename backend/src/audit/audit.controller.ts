import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../authorization/decorators/roles.decorator';
import {
  AuditQueryDto,
  TicketEventsQueryDto,
} from './dto/audit-query.dto';
import { AuditService } from './audit.service';
import { TicketEventsRepository } from '../tickets/events/ticket-events.repository';

@Controller('admin/audit-logs')
@Roles(UserRole.Admin)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly ticketEventsRepository: TicketEventsRepository,
  ) {}

  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.auditService.list(query);
  }

  @Get('ticket-events')
  ticketEvents(@Query() query: TicketEventsQueryDto) {
    return this.ticketEventsRepository.findAll(
      (query.page - 1) * query.pageSize,
      query.pageSize,
      query.action,
    );
  }

  @Get(':auditLogId')
  findOne(@Param('auditLogId') auditLogId: string) {
    return this.auditService.findById(auditLogId);
  }
}
