import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../authorization/decorators/public.decorator';
import { Roles } from '../authorization/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  AUTH_STATE_COOKIE_NAME,
  AUTH_STATE_LIFETIME_MS,
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_MS,
} from './authentication.constants';
import { AuthenticationService } from './authentication.service';
import { buildCookie, parseCookieHeader } from './cookies';
import type { AuthenticatedRequest } from './request-user';
import type { SessionDevice } from './sessions/session.entity';

@Controller('authentication')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Public()
  @Get('microsoft/login')
  microsoftLogin(@Res() response: Response): void {
    const login = this.authenticationService.startMicrosoftLogin();
    response.setHeader('Set-Cookie', this.buildAuthStateCookie(login.state));
    response.redirect(login.authorizationUrl);
  }

  @Public()
  @Get('microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string,
    @Query('state') state: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const cookies = parseCookieHeader(request.headers.cookie);
    const login = await this.authenticationService.completeMicrosoftLogin(
      code,
      state,
      cookies[AUTH_STATE_COOKIE_NAME],
      cookies[SESSION_COOKIE_NAME],
      this.getDevice(request),
    );

    response.setHeader('Set-Cookie', [
      this.buildSessionCookie(login.session.sessionId),
      this.clearCookie(
        AUTH_STATE_COOKIE_NAME,
        '/authentication/microsoft/callback',
      ),
    ]);

    response.redirect(this.getFrontendUrl());
  }

  @Public()
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.user };
  }

  @Public()
  @Post('logout')
  logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authenticationService.logout(request.sessionId);
    response.setHeader(
      'Set-Cookie',
      this.clearCookie(SESSION_COOKIE_NAME, '/'),
    );

    return { loggedOut: true };
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Post('logout-all-devices')
  logoutAllDevices(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!request.user) {
      throw new UnauthorizedException('An authenticated session is required');
    }

    this.authenticationService.logoutAllDevices(request.user.userId);
    response.setHeader(
      'Set-Cookie',
      this.clearCookie(SESSION_COOKIE_NAME, '/'),
    );

    return { loggedOut: true };
  }

  private buildSessionCookie(sessionId: string): string {
    return buildCookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAgeSeconds: SESSION_LIFETIME_MS / 1000,
    });
  }

  private buildAuthStateCookie(state: string): string {
    return buildCookie(AUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/authentication/microsoft/callback',
      maxAgeSeconds: AUTH_STATE_LIFETIME_MS / 1000,
    });
  }

  private clearCookie(name: string, path: string): string {
    return buildCookie(name, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path,
      maxAgeSeconds: 0,
      expires: new Date(0),
    });
  }

  private getDevice(request: AuthenticatedRequest): SessionDevice {
    const userAgent = request.headers['user-agent'];

    return {
      userAgent: Array.isArray(userAgent) ? userAgent.join(' ') : userAgent,
      ip: request.ip,
    };
  }

  private getFrontendUrl(): string {
    return process.env.FRONTEND_URL ?? 'http://localhost:5173';
  }
}
