import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type {
  IOtpRepository,
} from '../../../domain/repositories/otp.repository.interface';
import type { OtpCode } from '../../../domain/value-objects/otp-code.vo';

@Injectable()
export class PrismaOtpRepository implements IOtpRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PrismaOtpRepository.name);
  }

  async save(params: {
    userId: string;
    code: OtpCode;
    type: 'login' | 'email_verify' | 'password_reset';
  }): Promise<void> {
    await this.prisma.otpCode.create({
      data: {
        userId: params.userId,
        code: params.code.code,
        type: params.type,
        expiresAt: params.code.expiresAt,
      },
    });
  }

  async findValid(
    userId: string,
    type: 'login' | 'email_verify' | 'password_reset',
  ): Promise<{ id: string; code: string; expiresAt: Date } | null> {
    const row = await this.prisma.otpCode.findFirst({
      where: {
        userId,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return row
      ? { id: row.id, code: row.code, expiresAt: row.expiresAt }
      : null;
  }

  async markUsed(otpId: string): Promise<void> {
    await this.prisma.otpCode.update({
      where: { id: otpId },
      data: { usedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.otpCode.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
