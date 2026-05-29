import { BackupCodeInvalidException } from '../exceptions/auth-domain.exception';

/**
 * Single-use 2FA recovery code. Only the bcrypt hash is persisted; the raw
 * value is shown to the user once at issuance / regeneration.
 *
 * Spec: 8 codes per user, invalidated on first use.
 */
export const BACKUP_CODES_PER_USER = 8;
export const BACKUP_CODE_LENGTH = 10; // alphanum

export class BackupCode {
  private constructor(
    public readonly id: string | null,
    public readonly userId: string,
    public readonly codeHash: string,
    private _usedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  static create(props: {
    userId: string;
    codeHash: string;
    createdAt?: Date;
  }): BackupCode {
    if (!props.userId) throw new Error('BackupCode.userId is required');
    if (!props.codeHash) throw new Error('BackupCode.codeHash is required');
    return new BackupCode(
      null,
      props.userId,
      props.codeHash,
      null,
      props.createdAt ?? new Date(),
    );
  }

  static reconstitute(props: {
    id: string;
    userId: string;
    codeHash: string;
    usedAt: Date | null;
    createdAt: Date;
  }): BackupCode {
    return new BackupCode(
      props.id,
      props.userId,
      props.codeHash,
      props.usedAt,
      props.createdAt,
    );
  }

  get usedAt(): Date | null {
    return this._usedAt;
  }

  isUsed(): boolean {
    return this._usedAt !== null;
  }

  /**
   * Mark this code consumed. Caller is responsible for verifying the bcrypt
   * hash matches the candidate BEFORE invoking this method (hashing lives in
   * infrastructure, not the domain).
   */
  markUsed(now: Date = new Date()): void {
    if (this.isUsed()) {
      throw new BackupCodeInvalidException();
    }
    this._usedAt = now;
  }
}
