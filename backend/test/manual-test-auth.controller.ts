import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../src/authorization/decorators/public.decorator';
import {
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_MS,
} from '../src/authentication/authentication.constants';
import { buildCookie } from '../src/authentication/cookies';
import type { AuthenticatedRequest } from '../src/authentication/request-user';
import { toAuthenticatedRequestUser } from '../src/authentication/request-user';
import { SessionService } from '../src/authentication/sessions/session.service';
import { PrismaService } from '../src/database/prisma.service';
import { TEST_USER_IDS } from '../src/database/seed';

class TestLoginDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

const testUserIds = new Set<string>(TEST_USER_IDS);

@Public()
@Controller('__test/auth')
export class ManualTestAuthController {
  static prisma: PrismaService;
  static sessionService: SessionService;

  @Get()
  async configuration() {
    const users = await ManualTestAuthController.prisma.user.findMany({
      where: { userId: { in: [...TEST_USER_IDS] } },
      include: {
        departmentMembers: {
          include: { department: true },
          orderBy: { department: { name: 'asc' } },
        },
      },
    });
    const usersById = new Map(users.map((user) => [user.userId, user]));

    return {
      enabled: true,
      users: TEST_USER_IDS.map((userId) => usersById.get(userId))
        .filter((user) => user !== undefined)
        .map((user) => ({
          userId: user.userId,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          departments: user.departmentMembers.map(({ department }) => ({
            departmentId: department.departmentId,
            code: department.code,
            name: department.name,
          })),
        })),
    };
  }

  @Post('login')
  async login(
    @Body() body: TestLoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!testUserIds.has(body.userId)) {
      throw new BadRequestException('Only seeded test users can log in here');
    }

    const user = await ManualTestAuthController.prisma.user.findUnique({
      where: { userId: body.userId },
    });
    if (!user) {
      throw new BadRequestException('The selected test user does not exist');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('The selected test user is inactive');
    }

    const authenticatedUser = user.hasLogged
      ? user
      : await ManualTestAuthController.prisma.user.update({
          where: { userId: user.userId },
          data: {
            hasLogged: true,
            identityProviderUserId: `manual-test:${user.userId}`,
          },
        });

    const userAgent = request.headers['user-agent'];
    const session = ManualTestAuthController.sessionService.createSession(
      authenticatedUser.userId,
      {
        userAgent: Array.isArray(userAgent) ? userAgent.join(' ') : userAgent,
        ip: request.ip,
      },
    );

    response.setHeader(
      'Set-Cookie',
      buildCookie(SESSION_COOKIE_NAME, session.sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAgeSeconds: SESSION_LIFETIME_MS / 1000,
      }),
    );

    return { user: toAuthenticatedRequestUser(authenticatedUser) };
  }
}
