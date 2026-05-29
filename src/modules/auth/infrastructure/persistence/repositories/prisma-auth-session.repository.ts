import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { Prisma } from '../../../../../generated/prisma/client';
import type { IAuthSessionRepository } from '../../../domain/ports/auth-session.repository.port';
import { AuthSession } from '../../../domain/entities/auth-session.entity';
import { toAuthSession, type AuthSessionRow } from '../mappers/auth-session.mapper';

@Injectable()
export class PrismaAuthSessionRepository implements IAuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(session: AuthSession): Promise<string> {
    const row = await this.prisma.authSession.create({
      data: {
        userId: session.userId,
        refreshToken: session.refreshTokenHash.value,
        deviceInfo:
          session.deviceInfo === null
            ? Prisma.JsonNull
            : (session.deviceInfo as Prisma.InputJsonValue),
        userAgent: session.userAgent,
        deviceLabel: session.deviceLabel,
        ipAddress: session.ipAddress,
        lastActivityAt: session.lastActivityAt,
        revokedAt: session.revokedAt,
        expiresAt: session.expiresAt,
      },
      select: { id: true },
    });
    return row.id;
  }

  async save(session: AuthSession): Promise<void> {
    if (session.id === null) {
      throw new Error('Cannot save() a session without id — call create()');
    }
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshToken: session.refreshTokenHash.value,
        lastActivityAt: session.lastActivityAt,
        revokedAt: session.revokedAt,
        updatedAt: session.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<AuthSession | null> {
    const row = await this.prisma.authSession.findUnique({ where: { id } });
    return row ? toAuthSession(row as AuthSessionRow) : null;
  }

  async findByRefreshTokenHash(hash: string): Promise<AuthSession | null> {
    const row = await this.prisma.authSession.findUnique({
      where: { refreshToken: hash },
    });
    return row ? toAuthSession(row as AuthSessionRow) : null;
  }

  async findActiveByUserId(
    userId: string,
    now: Date = new Date(),
  ): Promise<AuthSession[]> {
    const rows = await this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
    return rows.map((r) => toAuthSession(r as AuthSessionRow));
  }

  async revokeAllForUser(
    userId: string,
    options: { exceptSessionId?: string; now?: Date } = {},
  ): Promise<string[]> {
    const now = options.now ?? new Date();
    const targets = await this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        ...(options.exceptSessionId
          ? { NOT: { id: options.exceptSessionId } }
          : {}),
      },
      select: { id: true },
    });
    if (targets.length === 0) return [];

    await this.prisma.authSession.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { revokedAt: now, updatedAt: now },
    });
    return targets.map((t) => t.id);
  }

  async revokeById(id: string, now: Date = new Date()): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now, updatedAt: now },
    });
  }
}
