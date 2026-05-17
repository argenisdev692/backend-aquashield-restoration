import type { SetupToken } from '../value-objects/setup-token.vo';

export type SetupTokenType = 'setup' | 'change';

export interface PasswordSetupRow {
  id: string;
  userId: string;
  type: SetupTokenType;
  expiresAt: Date;
}

export interface IPasswordSetupRepository {
  save(params: {
    userId: string;
    token: SetupToken;
    type: SetupTokenType;
    expiresAt: Date;
  }): Promise<void>;
  findValid(tokenHash: string): Promise<PasswordSetupRow | null>;
  markUsed(id: string): Promise<void>;
  invalidateAllForUser(userId: string, type: SetupTokenType): Promise<void>;
}

export const PASSWORD_SETUP_REPOSITORY = Symbol('IPasswordSetupRepository');
