import { Module } from '@nestjs/common';
import { AuthenticationModule } from './authentication/authentication.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { DatabaseModule } from './database/database.module';
import { DepartmentsModule } from './departments/departments.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { AdministrationModule } from './administration/administration.module';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    AuthenticationModule,
    AuthorizationModule,
    DepartmentsModule,
    TicketsModule,
    AdministrationModule,
  ],
})
export class AppModule {}
