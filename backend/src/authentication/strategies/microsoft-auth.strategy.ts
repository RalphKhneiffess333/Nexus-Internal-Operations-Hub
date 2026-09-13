import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicKey,
  type JsonWebKey as CryptoJsonWebKey,
  verify as verifySignature,
} from 'crypto';
import { MICROSOFT_ENTRA_PROVIDER_CODE } from '../authentication.constants';
import { AuthenticatedIdentity } from './authenticated-identity';
import { AuthenticationStrategy } from './authentication.strategy';

export interface MicrosoftAuthenticationInput {
  code: string;
}

interface MicrosoftTokenResponse {
  id_token?: string;
}

interface OpenIdConfiguration {
  issuer: string;
  jwks_uri: string;
}

type JsonWebKeyWithKid = CryptoJsonWebKey & { kid?: string };

interface JsonWebKeySet {
  keys: JsonWebKeyWithKid[];
}

interface MicrosoftIdTokenPayload {
  aud: string | string[];
  iss: string;
  exp: number;
  nbf?: number;
  tid?: string;
  sub?: string;
  oid?: string;
  email?: string;
  preferred_username?: string;
  upn?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

@Injectable()
export class MicrosoftAuthStrategy implements AuthenticationStrategy<MicrosoftAuthenticationInput> {
  constructor(private readonly configService: ConfigService) {}

  getAuthorizationUrl(state: string): string {
    const url = new URL(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize`,
    );

    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', this.scopes);
    url.searchParams.set('state', state);

    return url.toString();
  }

  async authenticate(
    input: MicrosoftAuthenticationInput,
  ): Promise<AuthenticatedIdentity> {
    if (!input.code) {
      throw new BadRequestException('Microsoft authorization code is missing');
    }

    const tokenResponse = await this.exchangeCodeForToken(input.code);
    if (!tokenResponse.id_token) {
      throw new UnauthorizedException('Microsoft identity token is missing');
    }

    const payload = await this.validateIdToken(tokenResponse.id_token);
    const providerUserId = payload.oid ?? payload.sub;
    const email =
      payload.email ?? payload.preferred_username ?? payload.upn ?? null;

    if (!providerUserId || !email) {
      throw new UnauthorizedException(
        'Microsoft identity token did not include required identity information',
      );
    }

    return {
      provider: MICROSOFT_ENTRA_PROVIDER_CODE,
      providerUserId,
      email: email.toLowerCase(),
      firstName: payload.given_name ?? null,
      lastName: payload.family_name ?? null,
      displayName:
        payload.name ??
        ([payload.given_name, payload.family_name].filter(Boolean).join(' ') ||
          email),
      phoneNumber: null,
    };
  }

  private async exchangeCodeForToken(
    code: string,
  ): Promise<MicrosoftTokenResponse> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      scope: this.scopes,
    });

    const response = await this.fetchWithRetries(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException('Microsoft token exchange was rejected');
    }

    return (await response.json()) as MicrosoftTokenResponse;
  }

  private async validateIdToken(
    idToken: string,
  ): Promise<MicrosoftIdTokenPayload> {
    const [encodedHeader, encodedPayload, encodedSignature] =
      idToken.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException('Microsoft identity token is malformed');
    }

    const header = this.decodeJwtSegment<{
      alg?: string;
      kid?: string;
    }>(encodedHeader);
    const payload =
      this.decodeJwtSegment<MicrosoftIdTokenPayload>(encodedPayload);

    if (header.alg !== 'RS256' || !header.kid) {
      throw new UnauthorizedException(
        'Microsoft identity token uses an unsupported signature',
      );
    }

    const openIdConfiguration = await this.getOpenIdConfiguration();
    const jwks = await this.getJsonWebKeySet(openIdConfiguration.jwks_uri);
    const signingKey = jwks.keys.find((key) => key.kid === header.kid);
    if (!signingKey) {
      throw new UnauthorizedException(
        'Microsoft identity token signing key was not found',
      );
    }

    const verified = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      createPublicKey({
        key: signingKey as unknown as CryptoJsonWebKey,
        format: 'jwk',
      }),
      Buffer.from(encodedSignature, 'base64url'),
    );
    if (!verified) {
      throw new UnauthorizedException(
        'Microsoft identity token signature is invalid',
      );
    }

    this.assertTokenClaims(payload, openIdConfiguration);
    return payload;
  }

  private assertTokenClaims(
    payload: MicrosoftIdTokenPayload,
    openIdConfiguration: OpenIdConfiguration,
  ): void {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSeconds) {
      throw new UnauthorizedException('Microsoft identity token is expired');
    }
    if (payload.nbf && payload.nbf > nowSeconds) {
      throw new UnauthorizedException(
        'Microsoft identity token is not valid yet',
      );
    }

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(this.clientId)) {
      throw new UnauthorizedException(
        'Microsoft identity token audience is invalid',
      );
    }

    const expectedIssuer = openIdConfiguration.issuer.replace(
      '{tenantid}',
      payload.tid ?? this.tenantId,
    );
    if (payload.iss !== expectedIssuer) {
      throw new UnauthorizedException(
        'Microsoft identity token issuer is invalid',
      );
    }
  }

  private async getOpenIdConfiguration(): Promise<OpenIdConfiguration> {
    const response = await this.fetchWithRetries(
      `https://login.microsoftonline.com/${this.tenantId}/v2.0/.well-known/openid-configuration`,
    );

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Microsoft OpenID configuration is unavailable',
      );
    }

    return (await response.json()) as OpenIdConfiguration;
  }

  private async getJsonWebKeySet(jwksUri: string): Promise<JsonWebKeySet> {
    const response = await this.fetchWithRetries(jwksUri);

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Microsoft signing keys are unavailable',
      );
    }

    return (await response.json()) as JsonWebKeySet;
  }

  private async fetchWithRetries(
    input: string,
    init?: RequestInit,
  ): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(input, init);
        if (response.status < 500) {
          return response;
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }

    throw new ServiceUnavailableException(
      `Microsoft authentication is unavailable: ${String(lastError)}`,
    );
  }

  private decodeJwtSegment<T>(segment: string): T {
    try {
      return JSON.parse(
        Buffer.from(segment, 'base64url').toString('utf8'),
      ) as T;
    } catch {
      throw new UnauthorizedException('Microsoft identity token is malformed');
    }
  }

  private get tenantId(): string {
    return this.requiredConfig('MICROSOFT_ENTRA_TENANT_ID');
  }

  private get clientId(): string {
    return this.requiredConfig('MICROSOFT_ENTRA_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.requiredConfig('MICROSOFT_ENTRA_CLIENT_SECRET');
  }

  private get redirectUri(): string {
    return this.requiredConfig('MICROSOFT_ENTRA_REDIRECT_URI');
  }

  private get scopes(): string {
    return (
      this.configService.get<string>('MICROSOFT_ENTRA_SCOPES') ??
      'openid profile email'
    );
  }

  private requiredConfig(name: string): string {
    const value = this.configService.get<string>(name);
    if (!value) {
      throw new ServiceUnavailableException(
        `${name} must be configured for Microsoft Entra authentication`,
      );
    }

    return value;
  }
}
