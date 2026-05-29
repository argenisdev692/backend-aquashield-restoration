import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import type { IOtpCodeRepository } from '../../../domain/ports/otp-code.repository.port';
import { OtpCode } from '../../../domain/entities/otp-code.entity';
import type { OtpCodeType } from '../../../domain/value-objects/otp-code-type.vo';
import { toOtpCode, type OtpCodeRow } from '../mappers/otp-code.mapper';

@Injectable()
export class PrismaOtpCodeRepository implements IOtpCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(otp: OtpCode): Promise<string> {
    const row = await this.prisma.otpCode.create({
      data: {
        userId: otp.userId,
        code: otp.code,
        type: otp.type,
        expiresAt: otp.expiresAt,
        usedAt: otp.usedAt,
      },
      select: { id: true },
    });
    return row.id;
  }

  async save(otp: OtpCode): Promise<void> {
    if (otp.id === null) {
      throw new Error('Cannot save() an OtpCode without id — call create()');
    }
    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: otp.usedAt },
    });
  }

  async findLatestActive(
    userId: string,
    type: OtpCodeType,
    now: Date = new Date(),
  ): Promise<OtpCode | null> {
    const row = await this.prisma.otpCode.findFirst({
      where: {
        userId,
        type,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toOtpCode(row as OtpCodeRow) : null;
  }

  async invalidatePending(
    userId: string,
    type: OtpCodeType,
    now: Date = new Date(),
  ): Promise<number> {
    const result = await this.prisma.otpCode.updateMany({
      where: { userId, type, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return result.count;
  }
}
