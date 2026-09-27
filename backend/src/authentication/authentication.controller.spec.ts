import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';

describe('AuthenticationController', () => {
  it('creates and clears authentication cookies with SameSite=Lax', async () => {
    const authenticationService = {
      completeMicrosoftLogin: jest.fn().mockResolvedValue({
        session: { sessionId: 'session-1' },
      }),
    } as unknown as AuthenticationService;
    const config = {
      get: jest.fn().mockReturnValue('http://nexus.test'),
    };
    const controller = new AuthenticationController(
      authenticationService,
      config as never,
    );
    const response = {
      setHeader: jest.fn(),
      redirect: jest.fn(),
    };

    await controller.microsoftCallback(
      'authorization-code',
      'state',
      { headers: { cookie: '' }, ip: '127.0.0.1' } as never,
      response as never,
    );

    const cookies = response.setHeader.mock.calls[0][1] as string[];
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining('nexus_session=session-1'),
        expect.stringContaining('SameSite=Lax'),
      ]),
    );
    expect(cookies.every((cookie) => cookie.includes('SameSite=Lax'))).toBe(
      true,
    );
  });

  it('redirects an inactive Microsoft account to the frontend deactivated screen', async () => {
    const authenticationService = {
      completeMicrosoftLogin: jest
        .fn()
        .mockRejectedValue(new UnauthorizedException('User account is inactive')),
    } as unknown as AuthenticationService;
    const config = {
      get: jest.fn().mockReturnValue('http://nexus.test'),
    };
    const controller = new AuthenticationController(
      authenticationService,
      config as never,
    );
    const response = {
      setHeader: jest.fn(),
      redirect: jest.fn(),
    };

    await controller.microsoftCallback(
      'authorization-code',
      'state',
      { headers: { cookie: '' }, ip: '127.0.0.1' } as never,
      response as never,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.any(Array),
    );
    expect(response.redirect).toHaveBeenCalledWith(
      'http://nexus.test/?account=deactivated',
    );
  });
});
