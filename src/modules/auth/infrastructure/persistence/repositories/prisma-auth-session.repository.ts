import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type {
  IAuthSessionRepository,
} from '../../../domain/repositories/auth-session.repository.interface';
import { AuthSession } from '../../../domain/entities/auth-session.aggregate';
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

  async findByRefreshToken(token: string): Promise<AuthSession | null> {
    const row = await this.prisma.authSession.findUnique({
      where: { refreshToken: token },
    });
    return row ? AuthSessionMapper.toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<AuthSession[]> {
    const rows = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
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
}
