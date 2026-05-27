import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { createHmac } from 'node:crypto';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import type { IAuditPort } from '../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../shared/activity-log/audit.port';
import { maskEmail } from '../../shared/utils/mask.util';
import { AuthTokenIssuer } from './services/auth-token-issuer.service';
import { ResendEmailAdapter } from './adapters/resend-email.adapter';
import { OtplibTotpAdapter } from './adapters/otplib-totp.adapter';
import { BcryptPasswordHasherAdapter } from './adapters/bcrypt-password-hasher.adapter';
import { JwtTokenAdapter } from './adapters/jwt-token.adapter';
import { GoogleAuthAdapter } from './adapters/google-auth.adapter';
import type { IStoragePort } from '../../shared/storage/storage.port';
import { STORAGE_PORT } from '../../shared/storage/storage.port';
import type { LoginInput } from './dto/login.dto';
import type { RegisterInput } from './dto/register.dto';
import type { UpdateProfileInput } from './dto/update-profile.dto';
import type { RequestPasswordResetInput } from './dto/request-password-reset.dto';
import type { ResetPasswordInput } from './dto/reset-password.dto';
import type { ConfirmPasswordInput } from './dto/confirm-password.dto';
import type { VerifyTwoFactorChallengeInput } from './dto/verify-two-factor-challenge.dto';
import type { GoogleAuthInput } from './dto/google-auth.dto';
import type { VerifyOtpInput } from './dto/verify-otp.dto';
import type { Confirm2faInput } from './dto/confirm-2fa.dto';
import type { VerifyTotpInput } from './dto/verify-totp.dto';
import type { ChangeExpiredPasswordInput } from './dto/change-expired-password.dto';
import type { LogoutInput } from './dto/logout.dto';

export interface IssuerUser {
  id: string;
  email: string;
  roleIds: string[];
  roleNames: string[];
  totpEnabled: boolean;
}

export interface LoginResult {
  requiresOtp: boolean;
  requiresTotp: boolean;
  requiresPasswordChange?: boolean;
  passwordChangeToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  trustedDevice?: boolean;
  mustEnroll2fa?: boolean;
}

export interface RegisterResult {
  id: string;
  email: string;
  message: string;
}

const FAILED_LOGIN_ALERT_THRESHOLD = 3;
const FAILED_LOGIN_LOCKOUT_THRESHOLD = 10;
const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const FAILED_LOGIN_WINDOW_SECONDS = 15 * 60;
const INVALID_CREDENTIALS_MSG = 'Invalid credentials';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly tokenIssuer: AuthTokenIssuer,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(STORAGE_PORT) private readonly storagePort: IStoragePort,
    private readonly emailAdapter: ResendEmailAdapter,
    private readonly totpAdapter: OtplibTotpAdapter,
    private readonly passwordHasher: BcryptPasswordHasherAdapter,
    private readonly tokenAdapter: JwtTokenAdapter,
    private readonly googleAuthAdapter: GoogleAuthAdapter,
  ) {
    this.logger.setContext(AuthService.name);
  }

  // ─── Authentication ────────────────────────────────────────────────────────

  async login(dto: LoginInput): Promise<LoginResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Login attempt', { traceId, email: maskEmail(dto.email) });

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.password) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MSG);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      this.logger.warn('Login blocked — account locked', {
        traceId,
        userId: user.id,
        lockedUntil: user.lockedUntil.toISOString(),
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS_MSG);
    }

    const valid = await this.passwordHasher.compare(
      dto.password,
      user.password,
    );
    if (!valid) {
      await this.handleFailedLogin(user.id, dto.email, traceId);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MSG);
    }

    await this.cache.del(`auth:login-failures:${dto.email}`);
    if (user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: null },
      });
    }

    const passwordExpired =
      user.passwordExpiresAt && user.passwordExpiresAt <= new Date();
    if (user.mustChangePassword || passwordExpired) {
      const passwordChangeToken =
        await this.tokenAdapter.signPasswordChangeToken(user.id);
      await this.audit.log({
        action: 'auth.password_change_required',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { reason: user.mustChangePassword ? 'forced' : 'expired' },
      });
      return {
        requiresOtp: false,
        requiresTotp: false,
        requiresPasswordChange: true,
        passwordChangeToken,
      };
    }

    // Trusted device check (simplified)
    const rawTrustedToken = this.cls.get<string>('trustedDeviceToken');
    if (rawTrustedToken) {
      const trusted = await this.prisma.trustedDevice.findFirst({
        where: {
          userId: user.id,
          deviceTokenHash: this.hashTrustedToken(rawTrustedToken),
          expiresAt: { gt: new Date() },
        },
      });
      if (trusted) {
        const userWithRoles = await this.prisma.user.findUnique({
          where: { id: user.id },
          include: { roles: { include: { role: true } } },
        });
        if (!userWithRoles) {
          throw new UnauthorizedException('User not found');
        }
        const roleIds = userWithRoles.roles.map((r) => r.roleId);
        const roleNames = userWithRoles.roles.map((r) => r.role.name);
        const issuerUser: IssuerUser = {
          id: userWithRoles.id,
          email: userWithRoles.email,
          roleIds,
          roleNames,
          totpEnabled: userWithRoles.totpEnabled,
        };
        const tokens = await this.tokenIssuer.issue(issuerUser);
        await this.prisma.trustedDevice.update({
          where: { id: trusted.id },
          data: { lastUsedAt: new Date() },
        });
        await this.audit.log({
          action: 'auth.login',
          resourceType: 'USER',
          resourceId: user.id,
          metadata: { method: 'trusted_device', trustedDeviceId: trusted.id },
        });
        return {
          requiresOtp: false,
          requiresTotp: false,
          trustedDevice: true,
          ...tokens,
        };
      }
    }

    // Generate OTP
    const otp = this.generateOtp(5);
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        code: otp,
        type: 'login',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    await this.emailAdapter.sendOtp({
      to: dto.email,
      code: otp,
      type: 'login',
    });
    await this.audit.log({
      action: 'auth.otp_requested',
      resourceType: 'USER',
      resourceId: user.id,
    });

    return { requiresOtp: true, requiresTotp: user.totpEnabled };
  }

  async register(dto: RegisterInput): Promise<RegisterResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Register attempt', {
      traceId,
      email: maskEmail(dto.email),
    });

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email address is already registered');
    }

    const hashedPassword = await this.passwordHasher.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        termsAndConditions: dto.termsAndConditions,
      },
    });

    await this.prisma.passwordHistory.create({
      data: { userId: user.id, passwordHash: hashedPassword },
    });

    await this.audit.log(
      { action: 'auth.registered', resourceType: 'USER', resourceId: user.id },
      { strict: true },
    );

    const verificationLink = this.buildVerificationLink(user.id, dto.email);
    await this.emailAdapter.sendVerificationLink({
      to: dto.email,
      verificationLink,
      name: dto.name,
    });
    await this.emailAdapter.sendWelcomeEmail({ to: dto.email, name: dto.name });

    this.eventEmitter.emit('auth.registered', {
      userId: user.id,
      email: dto.email,
    });

    return {
      id: user.id,
      email: user.email,
      message: 'Registration successful. Please verify your email address.',
    };
  }

  async logout(userId: string, dto: LogoutInput): Promise<void> {
    await this.prisma.authSession.deleteMany({
      where: { userId, refreshToken: dto.refreshToken },
    });
    await this.audit.log({
      action: 'auth.logout',
      resourceType: 'USER',
      resourceId: userId,
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { userId } });
    await this.audit.log({
      action: 'auth.logout_all',
      resourceType: 'USER',
      resourceId: userId,
    });
  }

  async refreshToken(dto: {
    refreshToken: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const session = await this.prisma.authSession.findUnique({
      where: { refreshToken: dto.refreshToken },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        roles: { include: { role: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roleIds = user.roles.map((r) => r.roleId);
    const roleNames = user.roles.map((r) => r.role.name);
    const issuerUser: IssuerUser = {
      id: user.id,
      email: user.email,
      roleIds,
      roleNames,
      totpEnabled: user.totpEnabled,
    };
    const tokens = await this.tokenIssuer.issue(issuerUser);
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return tokens;
  }

  // ─── Profile ───────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleRows = user.roles.map((r) => r.role);
    const fromRoles = roleRows.flatMap((r: any) =>
      r.permissions.map((p: any) => p.permission),
    );
    const fromDirect = user.permissions.map((p: any) => p.permission);
    const merged = new Map(
      [...fromRoles, ...fromDirect].map((p) => [`${p.action}:${p.subject}`, p]),
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      username: user.username,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
      address: user.address,
      address2: user.address2,
      zipCode: user.zipCode,
      city: user.city,
      state: user.state,
      country: user.country,
      gender: user.gender,
      profilePhotoPath: user.profilePhotoPath,
      emailVerified: !!user.emailVerifiedAt,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      totpEnabled: user.totpEnabled,
      passwordConfirmed: !!user.passwordConfirmedAt,
      hasGoogleAuth: !!user.googleId,
      roles: roleRows.map((r: any) => ({ id: r.id, name: r.name })),
      permissions: [...merged.values()].map((p) => ({
        action: p.action,
        subject: p.subject,
      })),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileInput) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        lastName: dto.lastName,
        phone: dto.phone,
      },
    });

    await this.audit.log({
      action: 'auth.profile_updated',
      resourceType: 'USER',
      resourceId: userId,
    });

    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    if (!userWithRoles) {
      throw new NotFoundException('User not found');
    }

    const roleRows = userWithRoles.roles.map((r) => r.role);
    const fromRoles = roleRows.flatMap((r: any) =>
      r.permissions.map((p: any) => p.permission),
    );
    const fromDirect = userWithRoles.permissions.map((p: any) => p.permission);
    const merged = new Map(
      [...fromRoles, ...fromDirect].map((p) => [`${p.action}:${p.subject}`, p]),
    );

    return {
      id: userWithRoles.id,
      email: userWithRoles.email,
      name: userWithRoles.name,
      lastName: userWithRoles.lastName,
      username: userWithRoles.username,
      phone: userWithRoles.phone,
      dateOfBirth: userWithRoles.dateOfBirth?.toISOString() ?? null,
      address: userWithRoles.address,
      address2: userWithRoles.address2,
      zipCode: userWithRoles.zipCode,
      city: userWithRoles.city,
      state: userWithRoles.state,
      country: userWithRoles.country,
      gender: userWithRoles.gender,
      profilePhotoPath: userWithRoles.profilePhotoPath,
      emailVerified: !!userWithRoles.emailVerifiedAt,
      emailVerifiedAt: userWithRoles.emailVerifiedAt?.toISOString() ?? null,
      totpEnabled: userWithRoles.totpEnabled,
      passwordConfirmed: !!userWithRoles.passwordConfirmedAt,
      hasGoogleAuth: !!userWithRoles.googleId,
      roles: roleRows.map((r: any) => ({ id: r.id, name: r.name })),
      permissions: [...merged.values()].map((p) => ({
        action: p.action,
        subject: p.subject,
      })),
      createdAt: userWithRoles.createdAt.toISOString(),
      updatedAt: userWithRoles.updatedAt.toISOString(),
    };
  }

  async uploadProfilePhoto(userId: string, file: Express.Multer.File) {
    const key = `profile-photos/${userId}/${Date.now()}-${file.originalname}`;
    const buffer = file.buffer;
    const contentType = file.mimetype;
    await this.storagePort.upload(key, buffer, contentType);
    const path = this.storagePort.publicUrl(key);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoPath: path },
    });

    await this.audit.log({
      action: 'auth.profile_photo_uploaded',
      resourceType: 'USER',
      resourceId: userId,
    });

    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    if (!userWithRoles) {
      throw new NotFoundException('User not found');
    }

    const roleRows = userWithRoles.roles.map((r) => r.role);
    const fromRoles = roleRows.flatMap((r: any) =>
      r.permissions.map((p: any) => p.permission),
    );
    const fromDirect = userWithRoles.permissions.map((p: any) => p.permission);
    const merged = new Map(
      [...fromRoles, ...fromDirect].map((p) => [`${p.action}:${p.subject}`, p]),
    );

    return {
      id: userWithRoles.id,
      email: userWithRoles.email,
      name: userWithRoles.name,
      lastName: userWithRoles.lastName,
      username: userWithRoles.username,
      phone: userWithRoles.phone,
      dateOfBirth: userWithRoles.dateOfBirth?.toISOString() ?? null,
      address: userWithRoles.address,
      address2: userWithRoles.address2,
      zipCode: userWithRoles.zipCode,
      city: userWithRoles.city,
      state: userWithRoles.state,
      country: userWithRoles.country,
      gender: userWithRoles.gender,
      profilePhotoPath: userWithRoles.profilePhotoPath,
      emailVerified: !!userWithRoles.emailVerifiedAt,
      emailVerifiedAt: userWithRoles.emailVerifiedAt?.toISOString() ?? null,
      totpEnabled: userWithRoles.totpEnabled,
      passwordConfirmed: !!userWithRoles.passwordConfirmedAt,
      hasGoogleAuth: !!userWithRoles.googleId,
      roles: roleRows.map((r: any) => ({ id: r.id, name: r.name })),
      permissions: [...merged.values()].map((p) => ({
        action: p.action,
        subject: p.subject,
      })),
      createdAt: userWithRoles.createdAt.toISOString(),
      updatedAt: userWithRoles.updatedAt.toISOString(),
    };
  }

  // ─── Password Reset ────────────────────────────────────────────────────────

  async requestPasswordReset(dto: RequestPasswordResetInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      // Return success even if user doesn't exist (security)
      return {
        message: 'If the email exists, a reset link has been sent.',
        resetToken: '',
      };
    }

    const token = this.generateResetToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const resetLink = `${this.config.get('APP_URL')}/auth/reset-password/${token}`;
    await this.emailAdapter.sendPasswordReset({ to: dto.email, resetLink });

    await this.audit.log({
      action: 'auth.password_reset_requested',
      resourceType: 'USER',
      resourceId: user.id,
    });

    return {
      message: 'If the email exists, a reset link has been sent.',
      resetToken: token,
    };
  }

  async validateResetToken(token: string) {
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });
    if (!reset || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    return { valid: true };
  }

  async resetPassword(dto: ResetPasswordInput) {
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.resetToken },
    });
    if (!reset || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await this.passwordHasher.hash(dto.password);
    await this.prisma.user.update({
      where: { id: reset.userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        passwordExpiresAt: null,
      },
    });

    await this.prisma.passwordHistory.create({
      data: { userId: reset.userId, passwordHash: hashedPassword },
    });
    await this.prisma.passwordResetToken.delete({ where: { id: reset.id } });

    await this.audit.log({
      action: 'auth.password_reset',
      resourceType: 'USER',
      resourceId: reset.userId,
    });

    return { message: 'Password has been reset successfully.' };
  }

  async changeExpiredPassword(dto: ChangeExpiredPasswordInput) {
    const payload = await this.tokenAdapter.verifyPasswordChangeToken(
      dto.passwordChangeToken,
    );
    const hashedPassword = await this.passwordHasher.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: payload.userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        passwordExpiresAt: null,
      },
    });

    await this.prisma.passwordHistory.create({
      data: { userId: payload.userId, passwordHash: hashedPassword },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        roles: { include: { role: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleIds = user.roles.map((r) => r.roleId);
    const roleNames = user.roles.map((r) => r.role.name);
    const issuerUser: IssuerUser = {
      id: user.id,
      email: user.email,
      roleIds,
      roleNames,
      totpEnabled: user.totpEnabled,
    };
    const tokens = await this.tokenIssuer.issue(issuerUser);
    await this.audit.log({
      action: 'auth.password_changed',
      resourceType: 'USER',
      resourceId: payload.userId,
    });

    return tokens;
  }

  // ─── Email Verification ─────────────────────────────────────────────────────

  async verifyEmail(userId: string, hash: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const expectedHash = this.computeEmailHash(userId, user.email);
    if (hash !== expectedHash) {
      throw new BadRequestException('Invalid verification link');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    await this.audit.log({
      action: 'auth.email_verified',
      resourceType: 'USER',
      resourceId: userId,
    });

    return { message: 'Email verified successfully.' };
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    const verificationLink = this.buildVerificationLink(user.id, user.email);
    await this.emailAdapter.sendVerificationLink({
      to: user.email,
      verificationLink,
      name: user.name,
    });

    await this.audit.log({
      action: 'auth.verification_resent',
      resourceType: 'USER',
      resourceId: userId,
    });

    return { message: 'Verification email has been sent.' };
  }

  // ─── Password Confirmation ───────────────────────────────────────────────────

  async getPasswordConfirmationStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      confirmed: !!user.passwordConfirmedAt,
      confirmedAt: user.passwordConfirmedAt?.toISOString() ?? null,
    };
  }

  async confirmPassword(userId: string, dto: ConfirmPasswordInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new NotFoundException('User not found');
    }

    const valid = await this.passwordHasher.compare(
      dto.password,
      user.password,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordConfirmedAt: new Date() },
    });
    await this.audit.log({
      action: 'auth.password_confirmed',
      resourceType: 'USER',
      resourceId: userId,
    });

    return { message: 'Password confirmed.' };
  }

  // ─── Two-Factor Challenge ───────────────────────────────────────────────────

  async verifyTwoFactorChallenge(dto: VerifyTwoFactorChallengeInput) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { code: dto.code, type: dto.type, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.prisma.otpCode.delete({ where: { id: otp.id } });

    const user = await this.prisma.user.findUnique({
      where: { id: otp.userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleIds = user.roles.map((r) => r.roleId);
    const roleNames = user.roles.map((r) => r.role.name);
    const issuerUser: IssuerUser = {
      id: user.id,
      email: user.email,
      roleIds,
      roleNames,
      totpEnabled: user.totpEnabled,
    };
    const tokens = await this.tokenIssuer.issue(issuerUser);
    await this.audit.log({
      action: 'auth.2fa_verified',
      resourceType: 'USER',
      resourceId: user.id,
    });

    return tokens;
  }

  async verifyOtp(dto: VerifyOtpInput) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { code: dto.code, type: dto.type, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.prisma.otpCode.delete({ where: { id: otp.id } });

    const user = await this.prisma.user.findUnique({
      where: { id: otp.userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleIds = user.roles.map((r) => r.roleId);
    const roleNames = user.roles.map((r) => r.role.name);
    const issuerUser: IssuerUser = {
      id: user.id,
      email: user.email,
      roleIds,
      roleNames,
      totpEnabled: user.totpEnabled,
    };
    const tokens = await this.tokenIssuer.issue(issuerUser);
    await this.audit.log({
      action: 'auth.otp_verified',
      resourceType: 'USER',
      resourceId: user.id,
    });

    return { ...tokens, requiresTotp: user.totpEnabled };
  }

  async verifyTotp(dto: VerifyTotpInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !user.totpSecret) {
      throw new UnauthorizedException('TOTP not enabled');
    }

    const valid = await this.totpAdapter.verify(dto.code, user.totpSecret);
    if (!valid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const roleIds = user.roles.map((r) => r.roleId);
    const roleNames = user.roles.map((r) => r.role.name);
    const issuerUser: IssuerUser = {
      id: user.id,
      email: user.email,
      roleIds,
      roleNames,
      totpEnabled: user.totpEnabled,
    };
    const tokens = await this.tokenIssuer.issue(issuerUser);
    await this.audit.log({
      action: 'auth.totp_verified',
      resourceType: 'USER',
      resourceId: user.id,
    });

    return tokens;
  }

  // ─── 2FA Management ────────────────────────────────────────────────────────

  async enable2fa(userId: string, email: string) {
    const secret = this.totpAdapter.generateSecret();
    const qrCode = this.totpAdapter.generateQrCode(email, secret);

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret },
    });

    return { secret, qrCodeUri: qrCode };
  }

  async confirm2fa(userId: string, dto: Confirm2faInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new BadRequestException('2FA not enabled');
    }

    const valid = await this.totpAdapter.verify(dto.code, user.totpSecret);
    if (!valid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });

    const backupCodes = Array.from({ length: 10 }, () => this.generateOtp(8));
    await this.prisma.backupCode.createMany({
      data: backupCodes.map((code) => ({
        userId,
        codeHash: this.hashBackupCode(code),
        used: false,
      })),
    });

    await this.audit.log({
      action: 'auth.2fa_enabled',
      resourceType: 'USER',
      resourceId: userId,
    });

    return { backupCodes };
  }

  async disable2fa(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });
    await this.prisma.backupCode.deleteMany({ where: { userId } });
    await this.audit.log({
      action: 'auth.2fa_disabled',
      resourceType: 'USER',
      resourceId: userId,
    });
  }

  async regenerateBackupCodes(userId: string) {
    await this.prisma.backupCode.deleteMany({ where: { userId } });

    const backupCodes = Array.from({ length: 10 }, () => this.generateOtp(8));
    await this.prisma.backupCode.createMany({
      data: backupCodes.map((code) => ({
        userId,
        codeHash: this.hashBackupCode(code),
        used: false,
      })),
    });

    await this.audit.log({
      action: 'auth.backup_codes_regenerated',
      resourceType: 'USER',
      resourceId: userId,
    });

    return { backupCodes };
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async listSessions(userId: string) {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    const currentSessionId = this.cls.get<string>('sessionId');
    const formattedSessions = sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      deviceLabel: s.deviceLabel,
      lastActivityAt: s.lastActivityAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isCurrent: s.id === currentSessionId,
    }));

    return { sessions: formattedSessions };
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.authSession.deleteMany({
      where: { userId, id: sessionId },
    });
    await this.audit.log({
      action: 'auth.session_revoked',
      resourceType: 'USER',
      resourceId: userId,
    });
  }

  // ─── Trusted Devices ───────────────────────────────────────────────────────

  async listTrustedDevices(userId: string) {
    const devices = await this.prisma.trustedDevice.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    const formattedDevices = devices.map((d) => ({
      id: d.id,
      label: d.label,
      ipAddress: d.ipAddress,
      userAgent: d.userAgent,
      lastUsedAt: d.lastUsedAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
      expiresAt: d.expiresAt.toISOString(),
    }));

    return { trustedDevices: formattedDevices };
  }

  async revokeTrustedDevice(userId: string, deviceId: string) {
    await this.prisma.trustedDevice.deleteMany({
      where: { userId, id: deviceId },
    });
    await this.audit.log({
      action: 'auth.trusted_device_revoked',
      resourceType: 'USER',
      resourceId: userId,
    });
  }

  // ─── Google Auth ─────────────────────────────────────────────────────────

  async googleAuth(dto: GoogleAuthInput) {
    const googleUser = await this.googleAuthAdapter.verifyToken(dto.idToken);
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });
    const isNewUser = !user;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          emailVerifiedAt: new Date(),
        },
      });
      await this.audit.log({
        action: 'auth.google_registered',
        resourceType: 'USER',
        resourceId: user.id,
      });
    }

    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { roles: { include: { role: true } } },
    });
    if (!userWithRoles) {
      throw new NotFoundException('User not found');
    }

    const roleIds = userWithRoles.roles.map((r) => r.roleId);
    const roleNames = userWithRoles.roles.map((r) => r.role.name);
    const issuerUser: IssuerUser = {
      id: userWithRoles.id,
      email: userWithRoles.email,
      roleIds,
      roleNames,
      totpEnabled: userWithRoles.totpEnabled,
    };
    const tokens = await this.tokenIssuer.issue(issuerUser);
    await this.audit.log({
      action: 'auth.google_login',
      resourceType: 'USER',
      resourceId: user.id,
    });

    return { ...tokens, isNewUser };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private async handleFailedLogin(
    userId: string,
    email: string,
    traceId: string,
  ) {
    const key = `auth:login-failures:${email}`;
    const current = (await this.cache.get<number>(key)) ?? 0;
    const updated = current + 1;

    await this.cache.set(key, updated, FAILED_LOGIN_WINDOW_SECONDS);
    await this.audit.log({
      action: 'auth.login_failed',
      resourceType: 'USER',
      resourceId: userId,
      metadata: { attempt: updated },
    });

    if (updated >= FAILED_LOGIN_LOCKOUT_THRESHOLD) {
      const lockedUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS);
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil },
      });
      await this.audit.log({
        action: 'auth.account_locked',
        resourceType: 'USER',
        resourceId: userId,
        metadata: {
          attemptCount: updated,
          lockedUntil: lockedUntil.toISOString(),
        },
      });
    }
  }

  private generateOtp(length: number): string {
    return Math.random()
      .toString(36)
      .substring(2, 2 + length)
      .toUpperCase();
  }

  private generateResetToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private buildVerificationLink(userId: string, email: string): string {
    const hash = this.computeEmailHash(userId, email);
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    return `${appUrl}/api/v1/auth/email/verify/${userId}/${hash}`;
  }

  private computeEmailHash(userId: string, email: string): string {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET') ?? '';
    return createHmac('sha256', secret)
      .update(`${userId}:${email}`)
      .digest('hex');
  }

  private hashTrustedToken(token: string): string {
    return createHmac('sha256', this.config.get('JWT_ACCESS_SECRET') ?? '')
      .update(token)
      .digest('hex');
  }

  private hashBackupCode(code: string): string {
    return createHmac('sha256', this.config.get('JWT_ACCESS_SECRET') ?? '')
      .update(code)
      .digest('hex');
  }
}
