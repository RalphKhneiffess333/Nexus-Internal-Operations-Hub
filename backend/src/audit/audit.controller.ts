import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../authorization/decorators/roles.decorator';
import { AuditQueryDto, TicketEventsQueryDto } from './dto/audit-query.dto';
import { AuditService } from './audit.service';
import { IdentifierValidationPipe } from '../common/pipes/identifier-validation.pipe';

@Controller('admin/audit-logs')
@Roles(UserRole.Admin)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.auditService.list(query);
  }

  @Get('ticket-events')
  ticketEvents(@Query() query: TicketEventsQueryDto) {
    return this.auditService.listTicketEvents(query);
  }

  @Get(':auditLogId')
  findOne(@Param('auditLogId', IdentifierValidationPipe) auditLogId: string) {
    return this.auditService.findById(auditLogId);
  }
}
