/**
 * Port for the password-hashing primitive. Adapter is bcrypt (cost 12)
 * because the password_history table holds existing bcrypt hashes and we
 * cannot migrate them to a different algorithm.
 */
export interface IPasswordHasher {
  hash(plaintext: string): Promise<string>;
  compare(plaintext: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('IPasswordHasher');
