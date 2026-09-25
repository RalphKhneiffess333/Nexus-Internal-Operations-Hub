import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';

describe('AuthenticationController', () => {
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
