import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../logger/logger.service';

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

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
export class GoogleAuthAdapter {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(GoogleAuthAdapter.name);
  }

  async verifyToken(idToken: string): Promise<GoogleUserInfo> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      this.logger.warn(
        'GOOGLE_CLIENT_ID not configured — Google auth disabled',
        {},
      );
      throw new Error('Google auth not configured');
    }

    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );

      if (!response.ok) {
        this.logger.warn('Google tokeninfo rejected token', {
          status: response.status,
        });
        throw new Error('Invalid Google token');
      }

      const payload = (await response.json()) as Record<string, unknown>;

      if (typeof payload['aud'] !== 'string' || payload['aud'] !== clientId) {
        this.logger.warn('Google token audience mismatch', {});
        throw new Error('Invalid Google token');
      }

      const iss = payload['iss'];
      if (
        iss !== 'accounts.google.com' &&
        iss !== 'https://accounts.google.com'
      ) {
        this.logger.warn('Google token issuer mismatch', {});
        throw new Error('Invalid Google token');
      }

      if (
        typeof payload['sub'] !== 'string' ||
        typeof payload['email'] !== 'string' ||
        typeof payload['name'] !== 'string'
      ) {
        throw new Error('Invalid Google token payload');
      }

      const emailVerified =
        payload['email_verified'] === 'true' ||
        payload['email_verified'] === true;
      if (!emailVerified) {
        this.logger.warn('Google token email not verified', {});
        throw new Error('Google email not verified');
      }

      return {
        googleId: payload['sub'],
        email: payload['email'],
        name: payload['name'],
        emailVerified,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.error('Google token verification failed', { error: message });
      throw new Error('Google token verification failed');
    }
  }
}
