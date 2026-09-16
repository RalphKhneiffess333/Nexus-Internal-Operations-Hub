import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { createSign, generateKeyPairSync, KeyObject } from 'crypto';
import { MicrosoftAuthStrategy } from './microsoft-auth.strategy';

type FetchMock = jest.MockedFunction<
  (input: string | URL | Request, init?: RequestInit) => Promise<Response>
>;

describe('MicrosoftAuthStrategy', () => {
  let strategy: MicrosoftAuthStrategy;
  let fetchMock: FetchMock;
  let privateKey: KeyObject;
  let publicJwk: JsonWebKey & { kid: string };

  beforeEach(() => {
    const keyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    privateKey = keyPair.privateKey;
    publicJwk = {
      ...keyPair.publicKey.export({ format: 'jwk' }),
      kid: 'key-1',
    };

    fetchMock = jest.spyOn(globalThis, 'fetch') as unknown as FetchMock;
    fetchMock.mockRejectedValue(new Error('Unexpected fetch call'));
    strategy = new MicrosoftAuthStrategy(configService() as ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the Microsoft common endpoint while testing account access is open', () => {
    const authorizationUrl = new URL(strategy.getAuthorizationUrl('state-1'));

    expect(authorizationUrl.origin).toBe('https://login.microsoftonline.com');
    expect(authorizationUrl.pathname).toBe('/common/oauth2/v2.0/authorize');
    expect(authorizationUrl.searchParams.get('state')).toBe('state-1');
  });

  it('rejects a missing authorization code', async () => {
    await expect(strategy.authenticate({ code: '' })).rejects.toThrow(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a failed token exchange', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 400));

    await expect(strategy.authenticate({ code: 'bad-code' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token response that omits the identity token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await expect(strategy.authenticate({ code: 'code' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a malformed identity token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id_token: 'malformed' }));

    await expect(strategy.authenticate({ code: 'code' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired identity token', async () => {
    mockMicrosoftResponses(
      signedToken({
        exp: Math.floor(Date.now() / 1000) - 1,
      }),
    );

    await expect(strategy.authenticate({ code: 'code' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an identity token with the wrong audience', async () => {
    mockMicrosoftResponses(
      signedToken({
        aud: 'different-client-id',
      }),
    );

    await expect(strategy.authenticate({ code: 'code' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an identity token with the wrong issuer', async () => {
    mockMicrosoftResponses(
      signedToken({
        iss: 'https://issuer.test/wrong',
      }),
    );

    await expect(strategy.authenticate({ code: 'code' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an identity token without required identity information', async () => {
    mockMicrosoftResponses(
      signedToken({
        oid: undefined,
        sub: undefined,
        email: undefined,
        preferred_username: undefined,
        upn: undefined,
      }),
    );

    await expect(strategy.authenticate({ code: 'code' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects unavailable Microsoft OpenID configuration', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id_token: signedToken() }))
      .mockResolvedValueOnce(jsonResponse({}, 503));

    await expect(strategy.authenticate({ code: 'code' })).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  function mockMicrosoftResponses(idToken: string): void {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id_token: idToken }))
      .mockResolvedValueOnce(
        jsonResponse({
          issuer: 'https://login.microsoftonline.com/{tenantid}/v2.0',
          jwks_uri: 'https://login.test/keys',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ keys: [publicJwk] }));
  }

  function signedToken(
    payloadOverrides: Record<string, unknown> = {},
    headerOverrides: Record<string, unknown> = {},
  ): string {
    const header = {
      alg: 'RS256',
      kid: 'key-1',
      ...headerOverrides,
    };
    const payload = stripUndefined({
      aud: 'client-id',
      iss: 'https://login.microsoftonline.com/tenant-1/v2.0',
      exp: Math.floor(Date.now() / 1000) + 60,
      tid: 'tenant-1',
      oid: 'entra-user-1',
      email: 'alex@company.com',
      name: 'Alex Employee',
      ...payloadOverrides,
    });
    const encodedHeader = base64UrlJson(header);
    const encodedPayload = base64UrlJson(payload);
    const signature = createSign('RSA-SHA256')
      .update(`${encodedHeader}.${encodedPayload}`)
      .sign(privateKey)
      .toString('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  function base64UrlJson(value: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  function stripUndefined(
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined),
    );
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  function configService(): Pick<ConfigService, 'get'> {
    return {
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
  }
});
