import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../authentication/request-user';
import { Roles } from '../authorization/decorators/roles.decorator';
import { ChatService } from './chat.service';

@Controller('chats')
export class ChatInboxController {
  constructor(private readonly chatService: ChatService) {}

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get()
  listConversations(@Req() request: AuthenticatedRequest) {
    return this.chatService.listConversations(request.user!);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Post(':ticketId/read')
  markRead(
    @Param('ticketId') ticketId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chatService.markConversationRead(ticketId, request.user!);
  }
}
