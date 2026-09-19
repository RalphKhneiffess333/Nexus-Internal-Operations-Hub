import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { AuthenticationGuard } from './guards/authentication.guard';
import { SessionsModule } from './sessions/sessions.module';
import { MicrosoftAuthStrategy } from './strategies/microsoft-auth.strategy';

@Module({
  imports: [UsersModule, SessionsModule],
  controllers: [AuthenticationController],
  providers: [
    AuthenticationService,
    MicrosoftAuthStrategy,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
  exports: [AuthenticationService, SessionsModule],
})
export class AuthenticationModule {}
