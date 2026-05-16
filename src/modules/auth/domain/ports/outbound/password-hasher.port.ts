/**
 * IPasswordHasherPort — outbound port for password hashing/verification.
 *
 * Keeps the `bcrypt` dependency out of the domain and application layers.
 */
export interface IPasswordHasherPort {
  compare(plain: string, hash: string): Promise<boolean>;
  hash(plain: string): Promise<string>;
}

export const PASSWORD_HASHER_PORT = Symbol('IPasswordHasherPort');
