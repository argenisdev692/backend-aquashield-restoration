import { UserAccount } from '../entities/user-account.aggregate';

/**
 * Repository port for the UserAccount aggregate. The Prisma adapter is the
 * ONLY implementation; it reads/writes the `users` table but exposes ONLY
 * the auth-relevant slice. Profile mutations live in the `users` module.
 */
export interface IUserAccountRepository {
  findById(id: string): Promise<UserAccount | null>;
  findByEmail(email: string): Promise<UserAccount | null>;
  findByGoogleId(googleId: string): Promise<UserAccount | null>;

  /**
   * Persist mutations done on the aggregate (passwordHash, totp*, googleId,
   * emailVerifiedAt, lockedUntil, mustChangePassword, passwordExpiresAt,
   * passwordChangedAt, passwordConfirmedAt). Throws if the row no longer
   * exists. Does NOT touch profile columns.
   */
  save(account: UserAccount): Promise<void>;

  /**
   * Create a brand-new user during register flow. Returns the persisted
   * aggregate (with id assigned by the DB).
   *
   * `name` / `lastName` / `termsAndConditions` live on the `users` row but
   * outside the aggregate, so they're passed alongside.
   */
  create(input: {
    name: string;
    lastName?: string | null;
    email: string;
    passwordHash: string | null;
    googleId?: string | null;
    emailVerifiedAt?: Date | null;
    termsAndConditions: boolean;
    /** Initial password TTL — register sets PASSWORD_EXPIRES_DAYS from env. */
    passwordExpiresAt?: Date | null;
    passwordChangedAt?: Date | null;
  }): Promise<UserAccount>;
}

export const USER_ACCOUNT_REPOSITORY = Symbol('IUserAccountRepository');
