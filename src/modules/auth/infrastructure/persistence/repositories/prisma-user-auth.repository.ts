import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import { SecretCipher } from '../../../../../shared/crypto/secret-cipher.service';
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
    private readonly cipher: SecretCipher,
  ) {
    this.logger.setContext(PrismaUserAuthRepository.name);
  }

  async findByEmail(email: string): Promise<UserAuthRow | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: { include: { role: { select: { id: true, name: true } } } },
      },
    });
    return row ? this.toAuthRow(row) : null;
  }

  async findById(id: string): Promise<UserAuthRow | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: { select: { id: true, name: true } } } },
      },
    });
    return row ? this.toAuthRow(row) : null;
  }

  async findByGoogleId(googleId: string): Promise<UserAuthRow | null> {
    const row = await this.prisma.user.findFirst({
      where: { googleId, deletedAt: null },
      include: {
        roles: { include: { role: { select: { id: true, name: true } } } },
      },
    });
    return row ? this.toAuthRow(row) : null;
  }

  async findProfileById(id: string): Promise<UserProfileRow | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                permissions: {
                  select: {
                    permission: { select: { action: true, subject: true } },
                  },
                },
              },
            },
          },
        },
        permissions: {
          where: { isGranted: true },
          include: {
            permission: { select: { action: true, subject: true } },
          },
        },
      },
    });
    if (!row) return null;

    // Effective permissions = role-inherited + direct grants, deduplicated
    // by `${action}:${subject}`. Mirrors UserMapper-style projection used
    // by GET /users so /auth/me and GET /users/:id agree.
    const dedupe = new Map<string, { action: string; subject: string }>();
    for (const ur of row.roles) {
      for (const rp of ur.role.permissions) {
        const { action, subject } = rp.permission;
        dedupe.set(`${action}:${subject}`, { action, subject });
      }
    }
    for (const up of row.permissions) {
      const { action, subject } = up.permission;
      dedupe.set(`${action}:${subject}`, { action, subject });
    }

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
      permissions: [...dedupe.values()],
      createdAt: row.createdAt,
    };
  }

  async create(data: CreateUserData): Promise<UserAuthRow> {
    const row = await this.prisma.user.create({
      data: {
        name: data.name,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.hashedPassword,
        termsAndConditions: data.termsAndConditions,
      },
      include: {
        roles: { include: { role: { select: { id: true, name: true } } } },
      },
    });
    return this.toAuthRow(row);
  }

  async updateTotpSecret(userId: string, secret: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      // Encrypted at rest (OWASP Cryptographic Failures — MFA seed).
      data: { totpSecret: this.cipher.encrypt(secret) },
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

  async updatePasswordWithStatus(
    userId: string,
    hashedPassword: string,
    passwordChangedAt: Date,
    passwordExpiresAt: Date | null,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordChangedAt,
        passwordExpiresAt,
        mustChangePassword: false,
      },
    });
  }

  async setMustChangePassword(userId: string, value: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: value },
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

  async setLockedUntil(userId: string, until: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: until },
    });
  }

  async clearLockedUntil(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: null },
    });
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.username !== undefined && { username: data.username }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.dateOfBirth !== undefined && {
          dateOfBirth: data.dateOfBirth,
        }),
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

  async updateProfilePhoto(userId: string, photoUrl: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoPath: photoUrl },
    });
  }

  private toAuthRow(row: {
    id: string;
    email: string;
    password: string | null;
    totpSecret: string | null;
    totpEnabled: boolean;
    googleId: string | null;
    emailVerifiedAt: Date | null;
    mustChangePassword: boolean;
    passwordExpiresAt: Date | null;
    lockedUntil: Date | null;
    roles: Array<{ role: { id: string; name: string } }>;
  }): UserAuthRow {
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      totpSecret: row.totpSecret ? this.cipher.decrypt(row.totpSecret) : null,
      totpEnabled: row.totpEnabled,
      googleId: row.googleId,
      emailVerifiedAt: row.emailVerifiedAt,
      mustChangePassword: row.mustChangePassword,
      passwordExpiresAt: row.passwordExpiresAt,
      lockedUntil: row.lockedUntil,
      roleIds: row.roles.map((r) => r.role.id),
      roleNames: row.roles.map((r) => r.role.name.toLowerCase()),
    };
  }
}
