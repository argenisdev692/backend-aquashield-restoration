import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type {
  IPasswordResetRepository,
  PasswordResetRow,
} from '../../../domain/repositories/password-reset.repository.interface';
import type { ResetToken } from '../../../domain/value-objects/reset-token.vo';

@Injectable()
export class PrismaPasswordResetRepository
  implements IPasswordResetRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PrismaPasswordResetRepository.name);
  }

  async save(params: {
    userId: string;
    token: ResetToken;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.passwordResetToken.create({
      data: {
        userId: params.userId,
        token: params.token.hash,
        expiresAt: params.expiresAt,
      },
    });
  }

  async findValid(tokenHash: string): Promise<PasswordResetRow | null> {
    const row = await this.prisma.passwordResetToken.findFirst({
      where: {
        token: tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row) return null;
    return { id: row.id, userId: row.userId, expiresAt: row.expiresAt };
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
