import { Module } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserProfileController } from './user-profile.controller';
import { AuditModule } from '../audit/audit.module';
import { TicketsModule } from '../tickets/tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserAccountService } from './user-account.service';
import { UserAdministrationService } from './user-administration.service';
import { UserMembershipService } from './user-membership.service';
import { UserResponseMapper } from './user-response.mapper';

@Module({
  imports: [AuditModule, TicketsModule, NotificationsModule],
  controllers: [UsersController, UserProfileController],
  providers: [
    UsersService,
    UsersRepository,
    UserAccountService,
    UserAdministrationService,
    UserMembershipService,
    UserResponseMapper,
  ],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
