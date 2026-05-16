import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type {
  IUserAuthRepository,
  UserAuthRow,
  UserProfileRow,
  CreateUserData,
  UpdateProfileData,
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
      include: { roles: { select: { roleId: true } } },
    });
    return row ? this.toAuthRow(row) : null;
  }

  async findById(id: string): Promise<UserAuthRow | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { select: { roleId: true } } },
    });
    return row ? this.toAuthRow(row) : null;
  }

  async findByGoogleId(googleId: string): Promise<UserAuthRow | null> {
    const row = await this.prisma.user.findFirst({
      where: { googleId, deletedAt: null },
      include: { roles: { select: { roleId: true } } },
    });
    return row ? this.toAuthRow(row) : null;
  }

  async findProfileById(id: string): Promise<UserProfileRow | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
        permissions: {
          include: {
            permission: { select: { action: true, subject: true } },
          },
        },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      lastName: row.lastName,
      username: row.username,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.dateOfBirth,
      address: row.address,
      address2: row.address2,
      zipCode: row.zipCode,
      city: row.city,
      state: row.state,
      country: row.country,
      gender: row.gender,
      profilePhotoPath: row.profilePhotoPath,
      emailVerifiedAt: row.emailVerifiedAt,
      totpEnabled: row.totpEnabled,
      passwordConfirmedAt: row.passwordConfirmedAt,
      googleId: row.googleId,
      roles: row.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      })),
      permissions: row.permissions.map((up) => ({
        action: up.permission.action,
        subject: up.permission.subject,
      })),
      createdAt: row.createdAt,
    };
  }

  async create(data: CreateUserData): Promise<UserAuthRow> {
    const row = await this.prisma.user.create({
      data: {
        name: data.name,
        lastName: data.lastName,
        email: data.email,
        password: data.hashedPassword,
        termsAndConditions: data.termsAndConditions,
      },
      include: { roles: { select: { roleId: true } } },
    });
    return this.toAuthRow(row);
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

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async setEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async setPasswordConfirmed(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordConfirmedAt: new Date() },
    });
  }

  async getPasswordConfirmedAt(userId: string): Promise<Date | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordConfirmedAt: true },
    });
    return row?.passwordConfirmedAt ?? null;
  }

  async setGoogleId(userId: string, googleId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { googleId },
    });
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileData,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.username !== undefined && { username: data.username }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.address2 !== undefined && { address2: data.address2 }),
        ...(data.zipCode !== undefined && { zipCode: data.zipCode }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.gender !== undefined && { gender: data.gender }),
      },
    });
  }

  private toAuthRow(
    row: {
      id: string;
      email: string;
      password: string | null;
      totpSecret: string | null;
      totpEnabled: boolean;
      googleId: string | null;
      emailVerifiedAt: Date | null;
      roles: Array<{ roleId: string }>;
    },
  ): UserAuthRow {
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      totpSecret: row.totpSecret,
      totpEnabled: row.totpEnabled,
      googleId: row.googleId,
      emailVerifiedAt: row.emailVerifiedAt,
      roleIds: row.roles.map((r) => r.roleId),
    };
  }
}
