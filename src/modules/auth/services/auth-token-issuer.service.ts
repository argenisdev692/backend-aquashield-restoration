import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../shared/database/prisma.service';
import { JwtTokenAdapter } from '../adapters/jwt-token.adapter';
import { CLS_KEYS } from '../../../shared/cls/cls.constants';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mustEnroll2fa?: boolean;
  isNewDevice?: boolean;
  trustedDeviceToken?: string;
  trustedDeviceTtlMs?: number;
}

export interface IssuerUser {
  id: string;
  email: string;
  roleIds: string[];
  roleNames: string[];
  totpEnabled: boolean;
}

@Injectable()
export class AuthTokenIssuer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenAdapter: JwtTokenAdapter,
    private readonly cls: ClsService,
  ) {}

  async issue(user: IssuerUser): Promise<IssuedTokens> {
    const userAgent = this.cls.get<string>(CLS_KEYS.USER_AGENT) ?? null;
    const ipAddress = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;

    // Detect "new device"
    let isNewDevice = false;
    try {
      const existing = await this.prisma.authSession.findFirst({
        where: {
          userId: user.id,
          expiresAt: { gt: new Date() },
          ...(userAgent && { userAgent }),
          ...(ipAddress && { ipAddress }),
        },
      });
      isNewDevice = !existing;
    } catch {
      isNewDevice = false;
    }

    const { token, expiresInSeconds } = await this.tokenAdapter.signAccessToken(
      {
        userId: user.id,
        email: user.email,
        roleIds: user.roleIds,
        roleNames: user.roleNames,
      },
    );

    const refreshToken = this.generateRefreshToken();
    const deviceLabel = this.deviceLabelFromUserAgent(userAgent);

    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent,
        deviceLabel,
        ipAddress,
        deviceInfo:
          userAgent || ipAddress
            ? { userAgent: userAgent ?? undefined, ip: ipAddress ?? undefined }
            : undefined,
        expiresAt: new Date(
          Date.now() + this.tokenAdapter.refreshTtlMs(user.roleNames),
        ),
      },
    });

    const mustEnroll2fa = this.requires2faEnrollment(user);

    return {
      accessToken: token,
      refreshToken,
      expiresIn: expiresInSeconds,
      mustEnroll2fa: mustEnroll2fa || undefined,
      isNewDevice: isNewDevice || undefined,
    };
  }

  async signPasswordChangeToken(userId: string): Promise<string> {
    return this.tokenAdapter.signPasswordChangeToken(userId);
  }

  async verifyPasswordChangeToken(token: string): Promise<{ userId: string }> {
    return this.tokenAdapter.verifyPasswordChangeToken(token);
  }

  private generateRefreshToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private deviceLabelFromUserAgent(userAgent: string | null): string {
    if (!userAgent) return 'Unknown Device';

    if (userAgent.includes('Mobile')) return 'Mobile Device';
    if (userAgent.includes('Tablet')) return 'Tablet';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Chrome')) return 'Chrome Browser';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';

    return 'Unknown Device';
  }

  private requires2faEnrollment(user: IssuerUser): boolean {
    return (
      (user.roleNames.includes('admin') ||
        user.roleNames.includes('superadmin')) &&
      !user.totpEnabled
    );
  }
}
