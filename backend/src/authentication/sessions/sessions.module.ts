import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionStore } from './session.store';

@Module({
  providers: [SessionService, SessionStore],
  exports: [SessionService],
})
export class SessionsModule {}
