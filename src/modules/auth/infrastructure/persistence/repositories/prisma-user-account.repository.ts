import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { SecretCipher } from '../../../../../shared/crypto/secret-cipher.service';
import type { IUserAccountRepository } from '../../../domain/ports/user-account.repository.port';
import type { UserAccount } from '../../../domain/entities/user-account.aggregate';
import {
  toUserAccount,
  toPersistencePatch,
  USER_ACCOUNT_SELECT,
  type UserAccountRow,
} from '../mappers/user-account.mapper';
import { UserAccountNotFoundException } from '../../../domain/exceptions/auth-domain.exception';

/**
 * Reads/writes the auth-relevant slice of the `users` table. Profile columns
 * are untouched — they belong to the `users` module.
 */
@Injectable()
export class PrismaUserAccountRepository implements IUserAccountRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipher,
  ) {}

  async findById(id: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_ACCOUNT_SELECT,
    });
    return row ? toUserAccount(row, this.cipher) : null;
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: USER_ACCOUNT_SELECT,
    });
    return row ? toUserAccount(row, this.cipher) : null;
  }

  async findByGoogleId(googleId: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findFirst({
      where: { googleId, deletedAt: null },
      select: USER_ACCOUNT_SELECT,
    });
    return row ? toUserAccount(row, this.cipher) : null;
  }

  async save(account: UserAccount): Promise<void> {
    const patch = toPersistencePatch(account, this.cipher);
    const result = await this.prisma.user.updateMany({
      where: { id: account.id, deletedAt: null },
      data: patch,
    });
    if (result.count === 0) {
      throw new UserAccountNotFoundException();
    }
  }

  async create(input: {
    name: string;
    lastName?: string | null;
    email: string;
    passwordHash: string | null;
    googleId?: string | null;
    emailVerifiedAt?: Date | null;
    termsAndConditions: boolean;
    passwordExpiresAt?: Date | null;
    passwordChangedAt?: Date | null;
  }): Promise<UserAccount> {
    const row = await this.prisma.user.create({
      data: {
        name: input.name,
        lastName: input.lastName ?? null,
        email: input.email.toLowerCase(),
        password: input.passwordHash,
        googleId: input.googleId ?? null,
        emailVerifiedAt: input.emailVerifiedAt ?? null,
        termsAndConditions: input.termsAndConditions,
        passwordExpiresAt: input.passwordExpiresAt ?? null,
        passwordChangedAt: input.passwordChangedAt ?? null,
      },
      select: USER_ACCOUNT_SELECT,
    });
    return toUserAccount(row, this.cipher);
  }
}
