import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IAuthSessionRepository } from '../../domain/repositories/auth-session.repository.interface';
import { AUTH_SESSION_REPOSITORY } from '../../domain/repositories/auth-session.repository.interface';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';

export interface SessionDto {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
  lastActivityAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

@Injectable()
export class ListSessionsUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepo: IAuthSessionRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ListSessionsUseCase.name);
  }

  async execute(userId: string): Promise<SessionDto[]> {
    const sessions = await this.sessionRepo.findByUserId(userId);
    const currentUa = this.cls.get<string>(CLS_KEYS.USER_AGENT) ?? null;
    const currentIp = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;

    // "Current" heuristic: best-effort match on UA + IP. Mobile clients can
    // bounce IPs constantly, so falling back to UA-only avoids labelling
    // every session as "another device" after a Wi-Fi/cellular switch.
    return sessions
      .filter((s) => s.isActive)
      .map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        deviceLabel: s.deviceLabel,
        lastActivityAt: s.lastActivityAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        isCurrent:
          (currentUa !== null && s.userAgent === currentUa &&
            (currentIp === null || s.ipAddress === currentIp)),
      }));
  }
}
