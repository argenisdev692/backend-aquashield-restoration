import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../logger/logger.service';
import type {
  IGoogleAuthPort,
  GoogleUserInfo,
} from '../../domain/ports/outbound/google-auth.port';

/**
 * Verifies Google ID tokens by calling Google's tokeninfo endpoint.
 *
 * For production, replace this with the `google-auth-library` package:
 *   const { OAuth2Client } = require('google-auth-library');
 *   const client = new OAuth2Client(clientId);
 *   const ticket = await client.verifyIdToken({ idToken, audience: clientId });
 *   const payload = ticket.getPayload();
 */
@Injectable()
export class GoogleAuthAdapter implements IGoogleAuthPort {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(GoogleAuthAdapter.name);
  }

  async verifyIdToken(idToken: string): Promise<GoogleUserInfo | null> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      this.logger.warn('GOOGLE_CLIENT_ID not configured — Google auth disabled', {});
      return null;
    }

    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );

      if (!response.ok) {
        this.logger.warn('Google tokeninfo rejected token', {
          status: response.status,
        });
        return null;
      }

      const payload = (await response.json()) as Record<string, unknown>;

      if (
        typeof payload['aud'] !== 'string' ||
        payload['aud'] !== clientId
      ) {
        this.logger.warn('Google token audience mismatch', {});
        return null;
      }

      if (
        typeof payload['sub'] !== 'string' ||
        typeof payload['email'] !== 'string' ||
        typeof payload['name'] !== 'string'
      ) {
        return null;
      }

      return {
        googleId: payload['sub'],
        email: payload['email'],
        name: payload['name'],
        emailVerified: payload['email_verified'] === 'true' || payload['email_verified'] === true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.error('Google token verification failed', { error: message });
      return null;
    }
  }
}
