import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../authorization/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../authentication/request-user';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { ModifyTicketDto } from './dto/modify-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Post()
  submit(@Body() dto: SubmitTicketDto, @Req() request: AuthenticatedRequest) {
    return this.ticketsService.submit(dto, request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.ticketsService.findAll(request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get('submitted')
  findSubmitted(@Req() request: AuthenticatedRequest) {
    return this.ticketsService.findSubmitted(request.user!);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Get('department')
  findDepartmentTickets(@Req() request: AuthenticatedRequest) {
    return this.ticketsService.findDepartmentTickets(request.user!);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Get('pool')
  findPool(@Req() request: AuthenticatedRequest) {
    return this.ticketsService.findPool(request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get(':id/events')
  findEvents(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.ticketsService.findEvents(id, request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get(':id/events/:eventId')
  findEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.findEvent(id, eventId, request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.ticketsService.findOne(id, request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Patch(':id')
  modify(
    @Param('id') id: string,
    @Body() dto: ModifyTicketDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.modify(id, dto, request.user!);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Post(':id/claim')
  claim(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.ticketsService.claim(id, request.user!);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Post(':id/close')
  close(
    @Param('id') id: string,
    @Body() dto: CloseTicketDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.close(id, dto, request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Post(':id/reopen')
  reopen(
    @Param('id') id: string,
    @Body() dto: ReopenTicketDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.reopen(id, dto, request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.ticketsService.cancel(id, request.user!);
  }
}
