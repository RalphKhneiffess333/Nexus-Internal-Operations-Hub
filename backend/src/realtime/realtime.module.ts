import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { TicketsModule } from '../tickets/tickets.module';
import { ChatModule } from '../chat/chat.module';
import { OperationsGateway } from './operations.gateway';

@Module({
  imports: [AuthenticationModule, TicketsModule, ChatModule],
  providers: [OperationsGateway],
  exports: [OperationsGateway],
})
export class RealtimeModule {}
