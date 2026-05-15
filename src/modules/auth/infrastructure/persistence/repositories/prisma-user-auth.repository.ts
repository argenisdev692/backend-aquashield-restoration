import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type {
  IUserAuthRepository,
  UserAuthRow,
} from '../../../domain/repositories/user-auth.repository.interface';

@Injectable()
export class PrismaUserAuthRepository implements IUserAuthRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PrismaUserAuthRepository.name);
  }

  async findByEmail(email: string): Promise<UserAuthRow | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: { select: { roleId: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      totpSecret: row.totpSecret,
      totpEnabled: row.totpEnabled,
      roleIds: row.roles.map((r) => r.roleId),
    };
  }

  async findById(id: string): Promise<UserAuthRow | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { select: { roleId: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      totpSecret: row.totpSecret,
      totpEnabled: row.totpEnabled,
      roleIds: row.roles.map((r) => r.roleId),
    };
  }

  async updateTotpSecret(userId: string, secret: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret },
    });
  }

  async enableTotp(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
  }

  async disableTotp(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });
  }
}
