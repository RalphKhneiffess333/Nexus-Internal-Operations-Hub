import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from '@jest/globals';
import { MicrosoftAuthStrategy } from './microsoft-auth.strategy';

describe('MicrosoftAuthStrategy', () => {
  it('uses the Microsoft common endpoint while testing account access is open', () => {
    const configService = {
      get: (name: string) => {
        const values: Record<string, string> = {
          MICROSOFT_ENTRA_TENANT_ID: 'organization-tenant-id',
          MICROSOFT_ENTRA_CLIENT_ID: 'client-id',
          MICROSOFT_ENTRA_CLIENT_SECRET: 'client-secret',
          MICROSOFT_ENTRA_REDIRECT_URI:
            'http://localhost:3000/authentication/microsoft/callback',
          MICROSOFT_ENTRA_SCOPES: 'openid profile email',
        };

        return values[name];
      },
    };
    const strategy = new MicrosoftAuthStrategy(
      configService as ConfigService,
    );

    const authorizationUrl = new URL(strategy.getAuthorizationUrl('state-1'));

    expect(authorizationUrl.origin).toBe('https://login.microsoftonline.com');
    expect(authorizationUrl.pathname).toBe('/common/oauth2/v2.0/authorize');
    expect(authorizationUrl.searchParams.get('state')).toBe('state-1');
  });
});
