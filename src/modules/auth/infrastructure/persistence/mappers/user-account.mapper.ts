import { Email } from '../../../domain/value-objects/email.vo';
import { TotpSecret } from '../../../domain/value-objects/totp-secret.vo';
import {
  UserAccount,
  type UserAccountProps,
} from '../../../domain/entities/user-account.aggregate';
import type { SecretCipher } from '../../../../../shared/crypto/secret-cipher.service';

/**
 * Auth-relevant slice of the `users` row. Profile columns (address, phone,
 * latitude, etc.) are NOT projected — auth never touches them.
 */
export interface UserAccountRow {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  password: string | null;
  totpSecret: string | null;
  totpEnabled: boolean;
  googleId: string | null;
  passwordConfirmedAt: Date | null;
  mustChangePassword: boolean;
  passwordExpiresAt: Date | null;
  passwordChangedAt: Date | null;
  lockedUntil: Date | null;
}

export type UserAccountColumnPicker = {
  id: true;
  email: true;
  emailVerifiedAt: true;
  password: true;
  totpSecret: true;
  totpEnabled: true;
  googleId: true;
  passwordConfirmedAt: true;
  mustChangePassword: true;
  passwordExpiresAt: true;
  passwordChangedAt: true;
  lockedUntil: true;
};

/**
 * Canonical projection for `findUnique` / `findFirst` so every query that
 * builds a UserAccount aggregate reads exactly the same columns.
 */
export const USER_ACCOUNT_SELECT: UserAccountColumnPicker = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  password: true,
  totpSecret: true,
  totpEnabled: true,
  googleId: true,
  passwordConfirmedAt: true,
  mustChangePassword: true,
  passwordExpiresAt: true,
  passwordChangedAt: true,
  lockedUntil: true,
} as const;

/**
 * Decrypts the at-rest TOTP secret (`SecretCipher`) and rehydrates the
 * aggregate. The cipher tolerates legacy plaintext rows so migrating from
 * an older codebase doesn't break login.
 */
export function toUserAccount(
  row: UserAccountRow,
  cipher: SecretCipher,
): UserAccount {
  const props: UserAccountProps = {
    id: row.id,
    email: Email.unsafeReconstitute(row.email),
    passwordHash: row.password,
    emailVerifiedAt: row.emailVerifiedAt,
    totpSecret:
      row.totpSecret !== null && row.totpSecret.length > 0
        ? TotpSecret.unsafeReconstitute(cipher.decrypt(row.totpSecret))
        : null,
    totpEnabled: row.totpEnabled,
    googleId: row.googleId,
    passwordConfirmedAt: row.passwordConfirmedAt,
    mustChangePassword: row.mustChangePassword,
    passwordExpiresAt: row.passwordExpiresAt,
    passwordChangedAt: row.passwordChangedAt,
    lockedUntil: row.lockedUntil,
  };
  return UserAccount.reconstitute(props);
}

/**
 * Build the partial `update` payload the repository will pass to Prisma —
 * encrypts the TOTP secret at the boundary so it never reaches the DB raw.
 */
export function toPersistencePatch(
  account: UserAccount,
  cipher: SecretCipher,
): {
  password: string | null;
  emailVerifiedAt: Date | null;
  totpSecret: string | null;
  totpEnabled: boolean;
  googleId: string | null;
  passwordConfirmedAt: Date | null;
  mustChangePassword: boolean;
  passwordExpiresAt: Date | null;
  passwordChangedAt: Date | null;
  lockedUntil: Date | null;
} {
  return {
    password: account.passwordHash,
    emailVerifiedAt: account.emailVerifiedAt,
    totpSecret:
      account.totpSecret !== null
        ? cipher.encrypt(account.totpSecret.reveal())
        : null,
    totpEnabled: account.totpEnabled,
    googleId: account.googleId,
    passwordConfirmedAt: account.passwordConfirmedAt,
    mustChangePassword: account.mustChangePassword,
    passwordExpiresAt: account.passwordExpiresAt,
    passwordChangedAt: account.passwordChangedAt,
    lockedUntil: account.lockedUntil,
  };
}
