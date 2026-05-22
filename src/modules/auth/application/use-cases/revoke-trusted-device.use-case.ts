import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LoggerService } from '../../../../logger/logger.service';
import type { ITrustedDeviceRepository } from '../../domain/repositories/trusted-device.repository.interface';
import { TRUSTED_DEVICE_REPOSITORY } from '../../domain/repositories/trusted-device.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';

@Injectable()
export class RevokeTrustedDeviceUseCase {
  constructor(
    @Inject(TRUSTED_DEVICE_REPOSITORY)
    private readonly repo: ITrustedDeviceRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(RevokeTrustedDeviceUseCase.name);
  }

  async execute(userId: string, id: string): Promise<void> {
    const ok = await this.repo.deleteByIdForUser(id, userId);
    if (!ok) throw new NotFoundException('Trusted device not found');
    await this.audit.log({
      action: 'auth.trusted_device_revoked',
      resourceType: 'USER',
      resourceId: userId,
      metadata: { trustedDeviceId: id },
    });
  }
}
