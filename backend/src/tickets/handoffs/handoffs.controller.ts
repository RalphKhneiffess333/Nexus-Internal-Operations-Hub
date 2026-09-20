import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../authorization/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../../authentication/request-user';
import { IdentifierValidationPipe } from '../../common/pipes/identifier-validation.pipe';
import { HandoffQueryDto } from './handoff.dto';
import { HandoffsService } from './handoffs.service';

@Controller('handoffs')
@Roles(UserRole.Agent, UserRole.Admin)
export class HandoffsController {
  constructor(private readonly handoffsService: HandoffsService) {}

  @Get()
  list(@Query() query: HandoffQueryDto, @Req() request: AuthenticatedRequest) {
    return this.handoffsService.list(
      request.user!,
      query.direction ?? 'all',
      query,
    );
  }

  @Get('participants')
  listParticipants(@Req() request: AuthenticatedRequest) {
    return this.handoffsService.listParticipants(request.user!);
  }

  @Post(':handoffId/accept')
  accept(
    @Param('handoffId', IdentifierValidationPipe) handoffId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handoffsService.accept(handoffId, request.user!);
  }

  @Post(':handoffId/reject')
  reject(
    @Param('handoffId', IdentifierValidationPipe) handoffId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handoffsService.reject(handoffId, request.user!);
  }

  @Post(':handoffId/cancel')
  cancel(
    @Param('handoffId', IdentifierValidationPipe) handoffId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handoffsService.cancel(handoffId, request.user!);
  }
}
