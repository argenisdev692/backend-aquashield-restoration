import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IPolicy } from 'cockatiel';
import { LoggerService } from '../../../../logger/logger.service';
import { createExternalServicePolicy } from '../../../../shared/external/resilience';
import type {
  IOAuthProvider,
  OAuthProfile,
} from '../../domain/ports/oauth-provider.port';

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: 'Bearer';
  id_token: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Minimal Google OAuth 2.0 adapter (Authorization Code flow). Uses the
 * userinfo endpoint to keep the dependency surface tiny — no JWT/JWKS dance.
 *
 * Account-takeover defense: rejects profiles whose `email_verified` is false
 * so an attacker controlling an unverified Google identity cannot claim an
 * existing email.
 *
 * The adapter is registered only if GOOGLE_CLIENT_ID is configured; otherwise
 * the auth.module binds an alternative implementation that throws on use.
 */
@Injectable()
export class GoogleOAuthAdapter implements IOAuthProvider {
  readonly provider = 'google' as const;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  /**
   * Retry + circuit-breaker around the two outbound Google calls (token
   * exchange + userinfo). A flap on Google's side opens the breaker and we
   * fail fast with 503 instead of holding the request open.
   */
  private readonly policy: IPolicy = createExternalServicePolicy(
    'google-oauth',
    'http-default',
  );

  constructor(
    config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(GoogleOAuthAdapter.name);
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    this.redirectUri = config.get<string>('GOOGLE_REDIRECT_URL') ?? '';
    // We do NOT throw in the constructor — the adapter must be instantiable
    // even when Google sign-in is intentionally disabled (env vars unset).
    // Methods below short-circuit with 503 if the config is missing.
  }

  /** True when all three Google env vars are configured. */
  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret && !!this.redirectUri;
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'AUTH_GOOGLE_DISABLED',
        message: 'Google sign-in is not configured on this server',
      });
    }
  }

  buildAuthorizationUrl(state: string): string {
    this.assertConfigured();
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      include_granted_scopes: 'true',
      state,
      prompt: 'select_account',
    });
    return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthProfile> {
    this.assertConfigured();

    const tokens = await this.policy.execute<GoogleTokenResponse>(async () => {
      const tokenRes = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) {
        this.logger.warn('Google token exchange failed', {
          status: tokenRes.status,
        });
        throw new UnauthorizedException('Google authentication failed');
      }
      return (await tokenRes.json()) as GoogleTokenResponse;
    });

    const user = await this.policy.execute<GoogleUserInfo>(async () => {
      const userRes = await fetch(USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!userRes.ok) {
        this.logger.warn('Google userinfo failed', { status: userRes.status });
        throw new UnauthorizedException('Google authentication failed');
      }
      return (await userRes.json()) as GoogleUserInfo;
    });

    if (!user.email || !user.email_verified) {
      // Account-takeover protection — never auto-link an unverified email.
      throw new UnauthorizedException('Google email is not verified');
    }

    return {
      providerId: user.sub,
      email: user.email.toLowerCase(),
      emailVerified: true,
      displayName: user.name ?? null,
      givenName: user.given_name ?? null,
      familyName: user.family_name ?? null,
      avatarUrl: user.picture ?? null,
    };
  }
}
