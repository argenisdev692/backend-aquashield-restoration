/**
 * Port for OAuth identity providers. v1 ships only Google.
 *
 * Account-takeover protection: the adapter MUST refuse profiles whose
 * `emailVerified === false`. If the provider does not expose that flag
 * (some providers don't), the adapter throws so the use-case rejects the
 * login rather than auto-linking an unverified email.
 */
export interface OAuthProfile {
  readonly providerId: string; // provider-stable user id
  readonly email: string;
  readonly emailVerified: boolean;
  readonly displayName: string | null;
  readonly givenName: string | null;
  readonly familyName: string | null;
  readonly avatarUrl: string | null;
}

export interface IOAuthProvider {
  readonly provider: 'google';

  /** Build the URL the controller redirects the user to. */
  buildAuthorizationUrl(state: string): string;

  /**
   * Exchange the code returned by the provider for a verified user profile.
   * Throws if the email is unverified or the code is invalid/expired.
   */
  exchangeCode(code: string): Promise<OAuthProfile>;
}

export const GOOGLE_OAUTH_PROVIDER = Symbol('IGoogleOAuthProvider');
