import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SESSION_COOKIE_NAME } from '../authentication.constants';
import { parseCookieHeader } from '../cookies';
import { AuthenticatedRequest } from '../request-user';
import { AuthenticationService } from '../authentication.service';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly authenticationService: AuthenticationService) {}

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

    const user =
      await this.authenticationService.authenticateSession(sessionId);
    if (!user) {
      // Preserve public endpoint behavior for expired or invalid cookies.
      // The authorization guard rejects this request when a route requires a
      // signed-in user.
      return true;
    }

    request.user = user;
    request.sessionId = sessionId;
    return true;
  }
}
