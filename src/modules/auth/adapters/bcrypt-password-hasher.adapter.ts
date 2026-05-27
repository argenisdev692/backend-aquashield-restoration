import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcrypt';

@Injectable()
export class BcryptPasswordHasherAdapter {
  constructor(private readonly config: ConfigService) {}

  compare(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
  }

  hash(plain: string): Promise<string> {
    const rounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    return hash(plain, rounds);
  }
}
