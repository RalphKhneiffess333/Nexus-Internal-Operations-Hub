import { Module } from '@nestjs/common';
import { DepartmentsModule } from '../departments/departments.module';
import { FilesModule } from '../files/files.module';
import { TicketsModule } from '../tickets/tickets.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatPolicy } from './policies/chat.policy';
import { ChatRepository } from './repositories/chat.repository';

@Module({
  imports: [TicketsModule, DepartmentsModule, FilesModule],
  controllers: [ChatController],
  providers: [ChatService, ChatPolicy, ChatRepository],
  exports: [ChatService],
})
export class ChatModule {}
