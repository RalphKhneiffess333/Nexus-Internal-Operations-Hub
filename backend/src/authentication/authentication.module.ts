import { forwardRef, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { AuthenticationGuard } from './guards/authentication.guard';
import { SessionService } from './sessions/session.service';
import { SessionStore } from './sessions/session.store';
import { MicrosoftAuthStrategy } from './strategies/microsoft-auth.strategy';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [AuthenticationController],
  providers: [
    AuthenticationService,
    MicrosoftAuthStrategy,
    SessionService,
    SessionStore,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
  exports: [AuthenticationService, SessionService],
})
export class AuthenticationModule {}
