import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { Roles } from '../authorization/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../authentication/request-user';
import { IdentifierValidationPipe } from '../common/pipes/identifier-validation.pipe';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { ModifyTicketDto } from './dto/modify-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { TicketsService } from './tickets.service';
import { MAX_FILE_SIZE, MAX_FILES_PER_EVENT } from '../files/file-validation';
import type { UploadedFileInput } from '../files/file-validation';
import { CreateHandoffDto, HandoffQueryDto } from './handoffs/handoff.dto';
import { HandoffsService } from './handoffs/handoffs.service';

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly handoffsService: HandoffsService,
  ) {}

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_EVENT, {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  submit(
    @Body() dto: SubmitTicketDto,
    @UploadedFiles() files: UploadedFileInput[] | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.submit(dto, request.user!, files);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get()
  findAll(
    @Query() query: TicketQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.findAll(request.user!, query);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get('submitted')
  findSubmitted(
    @Query() query: TicketQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.findSubmitted(request.user!, query);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Get('claimed')
  findClaimed(
    @Query() query: TicketQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.findClaimed(request.user!, query);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Get('resolved')
  findResolved(
    @Query() query: TicketQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.findResolved(request.user!, query);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Get('department')
  findDepartmentTickets(
    @Query() query: TicketQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.findDepartmentTickets(request.user!, query);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Get('pool')
  findPool(
    @Query() query: TicketQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.findPool(request.user!, query);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get(':id/events')
  findEvents(
    @Param('id', IdentifierValidationPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.findEvents(id, request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get(':id/events/:eventId')
  findEvent(
    @Param('id', IdentifierValidationPipe) id: string,
    @Param('eventId', IdentifierValidationPipe) eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.findEvent(id, eventId, request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get(':id/events/:eventId/attachments/:attachmentId')
  downloadAttachment(
    @Param('id', IdentifierValidationPipe) id: string,
    @Param('eventId', IdentifierValidationPipe) eventId: string,
    @Param('attachmentId', IdentifierValidationPipe) attachmentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    return this.ticketsService.downloadAttachment(
      id,
      eventId,
      attachmentId,
      request.user!,
    );
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get(':id')
  findOne(
    @Param('id', IdentifierValidationPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.findOne(id, request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_EVENT, {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  modify(
    @Param('id', IdentifierValidationPipe) id: string,
    @Body() dto: ModifyTicketDto,
    @UploadedFiles() files: UploadedFileInput[] | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.modify(id, dto, request.user!, files);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Post(':id/claim')
  claim(
    @Param('id', IdentifierValidationPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.claim(id, request.user!);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Post(':id/close')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_EVENT, {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  close(
    @Param('id', IdentifierValidationPipe) id: string,
    @Body() dto: CloseTicketDto,
    @UploadedFiles() files: UploadedFileInput[] | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.close(id, dto, request.user!, files);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Post(':id/reopen')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_EVENT, {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  reopen(
    @Param('id', IdentifierValidationPipe) id: string,
    @Body() dto: ReopenTicketDto,
    @UploadedFiles() files: UploadedFileInput[] | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.reopen(id, dto, request.user!, files);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Post(':id/cancel')
  cancel(
    @Param('id', IdentifierValidationPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ticketsService.cancel(id, request.user!);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Get(':id/handoffs/eligible-agents')
  listEligibleHandoffAgents(
    @Param('id', IdentifierValidationPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handoffsService.listEligibleAgents(id, request.user!);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Get(':id/handoffs')
  listHandoffs(
    @Param('id', IdentifierValidationPipe) id: string,
    @Query() query: HandoffQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handoffsService.listForTicket(id, request.user!, query.status);
  }

  @Roles(UserRole.Agent, UserRole.Admin)
  @Post(':id/handoffs')
  createHandoff(
    @Param('id', IdentifierValidationPipe) id: string,
    @Body() dto: CreateHandoffDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handoffsService.create(id, dto, request.user!);
  }
}
