import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SESSION_COOKIE_NAME } from '../authentication.constants';
import { parseCookieHeader } from '../cookies';
import {
  AuthenticatedRequest,
  toAuthenticatedRequestUser,
} from '../request-user';
import { SessionService } from '../sessions/session.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = null;
    request.sessionId = null;

    const sessionId = parseCookieHeader(request.headers.cookie)[
      SESSION_COOKIE_NAME
    ];
    if (!sessionId) {
      return true;
    }

    const session = this.sessionService.findById(sessionId);
    if (!session) {
      return true;
    }

    const user = await this.usersService.findById(session.userId);
    if (!user || !user.isActive) {
      this.sessionService.deleteSession(sessionId);
      throw new UnauthorizedException(
        'Authenticated user account is inactive or missing',
      );
    }

    this.sessionService.refreshSession(sessionId);
    request.user = toAuthenticatedRequestUser(user);
    request.sessionId = sessionId;
    return true;
  }
}
