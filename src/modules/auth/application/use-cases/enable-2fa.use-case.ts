import { Inject, Injectable } from '@nestjs/common';
import { generateURI } from 'otplib';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type {
  IUserAuthRepository,
} from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import { TotpSecret } from '../../domain/value-objects/totp-secret.vo';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';

export interface Enable2faResult {
  secret: string;
  qrCodeUri: string;
}

@Injectable()
export class Enable2faUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(Enable2faUseCase.name);
  }

  async execute(userId: string, email: string): Promise<Enable2faResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Enable 2FA initiated', { traceId, userId });

    const secret = TotpSecret.generate();
    await this.userRepo.updateTotpSecret(userId, secret.value);

    const uri = generateURI({
      issuer: 'Vidula',
      label: email,
      secret: secret.value,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
    });

    await this.audit.log({
      action: 'auth.2fa_initiated',
      resourceType: 'USER',
      resourceId: userId,
    });

    return { secret: secret.value, qrCodeUri: uri };
  }
}
