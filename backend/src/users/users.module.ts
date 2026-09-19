import { forwardRef, Module } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserProfileController } from './user-profile.controller';
import { AuditModule } from '../audit/audit.module';
import { AuthenticationModule } from '../authentication/authentication.module';
import { TicketsModule } from '../tickets/tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    AuditModule,
    forwardRef(() => AuthenticationModule),
    forwardRef(() => TicketsModule),
    NotificationsModule,
  ],
  controllers: [UsersController, UserProfileController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
