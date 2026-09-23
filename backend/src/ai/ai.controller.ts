import { Body, Controller, Post, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../authentication/request-user';
import { Roles } from '../authorization/decorators/roles.decorator';
import { AiService } from './ai.service';
import { AssistantMessageDto } from './dto/assistant-message.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Post('messages')
  sendMessage(
    @Body() dto: AssistantMessageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.aiService.respond(dto, request.user!);
  }
}
