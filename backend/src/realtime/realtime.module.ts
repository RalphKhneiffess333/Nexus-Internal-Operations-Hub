import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { TicketsModule } from '../tickets/tickets.module';
import { OperationsGateway } from './operations.gateway';

@Module({
  imports: [AuthenticationModule, TicketsModule],
  providers: [OperationsGateway],
  exports: [OperationsGateway],
})
export class RealtimeModule {}
