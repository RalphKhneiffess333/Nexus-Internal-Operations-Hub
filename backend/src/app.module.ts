import { Module } from '@nestjs/common';
import { AuthenticationModule } from './authentication/authentication.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { DatabaseModule } from './database/database.module';
import { DepartmentsModule } from './departments/departments.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { AdministrationModule } from './administration/administration.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RealtimeModule } from './realtime/realtime.module';
import { ChatModule } from './chat/chat.module';
import { BackgroundWorkersModule } from './background-workers/background-workers.module';
import { PrioritiesModule } from './priorities/priorities.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    DatabaseModule,
    UsersModule,
    AuthenticationModule,
    AuthorizationModule,
    DepartmentsModule,
    TicketsModule,
    AdministrationModule,
    DashboardModule,
    ChatModule,
    RealtimeModule,
    BackgroundWorkersModule,
    PrioritiesModule,
  ],
})
export class AppModule {}
