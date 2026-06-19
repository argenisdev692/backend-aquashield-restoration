import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../shared/activity-log/audit.port';
import {
  TRUSTED_DEVICE_REPOSITORY,
  type ITrustedDeviceRepository,
} from '../../domain/ports/trusted-device.repository.port';

/**
 * Revoke a single trusted-device cookie. Ownership enforced via 404-on-
 * mismatch (no enumeration). `deleteAllForCurrentUser` is the bulk variant.
 */
@Injectable()
export class RevokeTrustedDeviceUseCase {
  constructor(
    @Inject(TRUSTED_DEVICE_REPOSITORY)
    private readonly devices: ITrustedDeviceRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(RevokeTrustedDeviceUseCase.name);
  }

  async revokeOne(args: { userId: string; deviceId: string }): Promise<void> {
    // findByUserId returns ALL rows for the user; we filter for the id here
    // so a foreign-id lookup never leaks via timing differences.
    const own = await this.devices.findByUserId(args.userId);
    const target = own.find((d) => d.id === args.deviceId);
    if (!target) throw new NotFoundException('Trusted device not found');

    await this.devices.deleteById(target.id!);

    await this.audit.log({
      action: 'auth.trusted_device.revoked',
      actorId: args.userId,
      resourceType: 'TRUSTED_DEVICE',
      resourceId: target.id!,
      metadata: {
        ipAddress: this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null,
      },
    });

    this.logger.info('Trusted device revoked', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId: args.userId,
      deviceId: target.id,
    });
  }

  async revokeAll(userId: string): Promise<{ revoked: boolean }> {
    await this.devices.deleteAllForUser(userId);
    await this.audit.log({
      action: 'auth.trusted_device.revoked_all',
      actorId: userId,
      resourceType: 'USER',
      resourceId: userId,
      metadata: {
        ipAddress: this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null,
      },
    });
    return { revoked: true };
  }
}
