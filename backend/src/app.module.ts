import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthenticationModule } from './authentication/authentication.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { validateEnvironment } from './config/environment.validation';
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
import { FiltersModule } from './filters/filters.module';
import { AiModule } from './ai/ai.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
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
    FiltersModule,
    AiModule,
    HealthModule,
  ],
})
export class AppModule {}
