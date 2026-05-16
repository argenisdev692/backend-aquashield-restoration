export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface IGoogleAuthPort {
  verifyIdToken(idToken: string): Promise<GoogleUserInfo | null>;
}

export const GOOGLE_AUTH_PORT = Symbol('IGoogleAuthPort');
