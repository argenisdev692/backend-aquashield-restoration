import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcrypt';
import type { IPasswordHasherPort } from './password-hasher.port';

/**
 * Bcrypt implementation of {@link IPasswordHasherPort}.
 *
 * Cost factor comes from `BCRYPT_SALT_ROUNDS` (validated in env.config).
 * Single source of truth for password hashing — auth, users, and any future
 * module must inject this instead of re-implementing bcrypt.
 */
@Injectable()
export class BcryptPasswordHasherAdapter implements IPasswordHasherPort {
  constructor(private readonly config: ConfigService) {}

  hash(plain: string): Promise<string> {
    const rounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    return hash(plain, rounds);
  }

  compare(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
  }
}
