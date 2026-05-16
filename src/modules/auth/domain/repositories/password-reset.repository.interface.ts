import type { ResetToken } from '../value-objects/reset-token.vo';

export interface PasswordResetRow {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface IPasswordResetRepository {
  save(params: {
    userId: string;
    token: ResetToken;
    expiresAt: Date;
  }): Promise<void>;
  findValid(tokenHash: string): Promise<PasswordResetRow | null>;
  markUsed(id: string): Promise<void>;
  invalidateAllForUser(userId: string): Promise<void>;
}

export const PASSWORD_RESET_REPOSITORY = Symbol('IPasswordResetRepository');
