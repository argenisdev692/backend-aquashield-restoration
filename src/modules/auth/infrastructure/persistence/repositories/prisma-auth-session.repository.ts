import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IAuthSessionRepository } from '../../../domain/repositories/auth-session.repository.interface';
import { AuthSession } from '../../../domain/entities/auth-session.aggregate';
import { RefreshToken } from '../../../domain/value-objects/refresh-token.vo';
import { AuthSessionMapper } from '../mappers/auth-session.mapper';

@Injectable()
export class PrismaAuthSessionRepository implements IAuthSessionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PrismaAuthSessionRepository.name);
  }

  async save(session: AuthSession): Promise<void> {
    const data = AuthSessionMapper.toPersistence(session);
    await this.prisma.authSession.create({ data });
  }

  /**
   * Looks up a session by the raw refresh token presented by the client.
   * The DB column holds the SHA-256 hash, so we hash the input before query.
   */
  async findByRefreshToken(token: string): Promise<AuthSession | null> {
    const row = await this.prisma.authSession.findUnique({
      where: { refreshToken: RefreshToken.hashOf(token) },
    });
    return row ? AuthSessionMapper.toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<AuthSession[]> {
    const rows = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastActivityAt: 'desc' },
    });
    return rows.map((r) => AuthSessionMapper.toDomain(r));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeById(sessionId: string): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByIdForUser(
    sessionId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async touch(sessionId: string, at: Date = new Date()): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { lastActivityAt: at },
    });
  }

  async hasMatchingActiveSession(
    userId: string,
    userAgent: string | null,
    ipAddress: string | null,
  ): Promise<boolean> {
    // Either UA OR IP match is enough — switching networks should not trigger
    // an alert when the device fingerprint is recognised, and vice versa.
    const ors: Array<{ userAgent?: string; ipAddress?: string }> = [];
    if (userAgent) ors.push({ userAgent });
    if (ipAddress) ors.push({ ipAddress });
    if (ors.length === 0) return true; // Nothing to compare against → treat as known.

    const match = await this.prisma.authSession.findFirst({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        OR: ors,
      },
      select: { id: true },
    });
    return match !== null;
  }
}
