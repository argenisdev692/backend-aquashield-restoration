/**
 * IPasswordHasherPort — outbound port for password hashing/verification.
 *
 * Implementations live in `shared/security/` so any module that needs to
 * hash or verify a password injects the same adapter. The current bcrypt
 * cost factor is read from `BCRYPT_SALT_ROUNDS`.
 */
export interface IPasswordHasherPort {
  hash(plain: string): Promise<string>;
  compare(plain: string, hashed: string): Promise<boolean>;
}

export const PASSWORD_HASHER_PORT = Symbol('IPasswordHasherPort');
