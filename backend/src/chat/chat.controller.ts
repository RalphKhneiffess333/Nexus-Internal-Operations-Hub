import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedRequest } from '../authentication/request-user';
import { IdentifierValidationPipe } from '../common/pipes/identifier-validation.pipe';
import { Roles } from '../authorization/decorators/roles.decorator';
import { MAX_FILES_PER_EVENT, MAX_FILE_SIZE } from '../files/file-validation';
import type { UploadedFileInput } from '../files/file-validation';
import { ChatService } from './chat.service';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';

@Controller('tickets/:ticketId/chat/messages')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get()
  listMessages(
    @Param('ticketId', IdentifierValidationPipe) ticketId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chatService.listMessages(ticketId, request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_EVENT, {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  createMessage(
    @Param('ticketId', IdentifierValidationPipe) ticketId: string,
    @Body() dto: CreateChatMessageDto,
    @UploadedFiles() files: UploadedFileInput[] | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chatService.createMessage(ticketId, dto, request.user!, files);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get(':messageId/attachments/:attachmentId')
  downloadAttachment(
    @Param('ticketId', IdentifierValidationPipe) ticketId: string,
    @Param('messageId', IdentifierValidationPipe) messageId: string,
    @Param('attachmentId', IdentifierValidationPipe) attachmentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    return this.chatService.downloadAttachment(
      ticketId,
      messageId,
      attachmentId,
      request.user!,
    );
  }
}
