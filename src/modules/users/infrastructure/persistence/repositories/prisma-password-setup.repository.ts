import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type {
  IPasswordSetupRepository,
  PasswordSetupRow,
  SetupTokenType,
} from '../../../domain/repositories/password-setup.repository.interface';
import type { SetupToken } from '../../../domain/value-objects/setup-token.vo';

const VALID_TOKEN_TYPES: ReadonlySet<string> = new Set<SetupTokenType>([
  'setup',
  'change',
]);

function toSetupTokenType(value: string): SetupTokenType {
  if (!VALID_TOKEN_TYPES.has(value)) {
    throw new Error(`Unknown token type: ${value}`);
  }
  return value as SetupTokenType;
}

@Injectable()
export class PrismaPasswordSetupRepository
  implements IPasswordSetupRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async save(params: {
    userId: string;
    token: SetupToken;
    type: SetupTokenType;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.passwordSetupToken.create({
      data: {
        userId: params.userId,
        token: params.token.hash,
        type: params.type,
        expiresAt: params.expiresAt,
      },
    });
  }

  async findValid(tokenHash: string): Promise<PasswordSetupRow | null> {
    const row = await this.prisma.passwordSetupToken.findFirst({
      where: {
        token: tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      type: toSetupTokenType(row.type),
      expiresAt: row.expiresAt,
    };
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.passwordSetupToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async invalidateAllForUser(
    userId: string,
    type: SetupTokenType,
  ): Promise<void> {
    await this.prisma.passwordSetupToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
