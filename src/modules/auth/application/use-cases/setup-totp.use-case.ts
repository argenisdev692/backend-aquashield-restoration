import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { toDataURL as qrToDataUrl } from 'qrcode';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CompanyBrandingService } from '../../../companydata/company-branding.service';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../shared/activity-log/audit.port';
import {
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import { TOTP_SERVICE, type ITotpService } from '../../domain/ports/totp.port';
import { TotpSecret } from '../../domain/value-objects/totp-secret.vo';
import {
  TwoFactorAlreadyEnabledException,
  UserAccountNotFoundException,
} from '../../domain/exceptions/auth-domain.exception';

export interface SetupTotpResult {
  /** Base32 secret — show to the user once for manual entry. */
  secret: string;
  /** `otpauth://...` URI the QR code encodes. */
  otpAuthUri: string;
  /** Pre-rendered QR code as a data URL (`image/png;base64,...`). */
  qrCodeDataUrl: string;
}

/**
 * Generate a fresh TOTP secret and persist it on the account WITHOUT
 * enabling 2FA — the user must verify a code via `enable-totp` first.
 *
 * Stacked behind `FreshPasswordGuard` at the controller layer.
 */
@Injectable()
export class SetupTotpUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(TOTP_SERVICE) private readonly totp: ITotpService,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly branding: CompanyBrandingService,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SetupTotpUseCase.name);
  }

  @Transactional()
  async execute(userId: string): Promise<SetupTotpResult> {
    const account = await this.accounts.findById(userId);
    if (!account) throw new UserAccountNotFoundException();
    if (account.totpEnabled) {
      // Refuse to overwrite an active secret — the user must disable first.
      throw new TwoFactorAlreadyEnabledException();
    }

    const secretRaw = this.totp.generateSecret();
    const secret = TotpSecret.create(secretRaw);

    account.startTwoFactorSetup(secret);
    await this.accounts.save(account);

    // Issuer label shown in the authenticator app — the company brand
    // (CompanyData singleton, COMPANY_NAME env fallback), never a hardcoded
    // brand. Resolved per-execution so a renamed company propagates.
    const issuer = await this.branding.getCompanyName();
    const otpAuthUri = this.totp.buildOtpAuthUri({
      secret: secretRaw,
      accountName: account.email.value,
      issuer,
    });
    const qrCodeDataUrl = await qrToDataUrl(otpAuthUri, {
      errorCorrectionLevel: 'M',
    });

    await this.audit.log({
      action: 'auth.two_factor.setup_initiated',
      actorId: userId,
      resourceType: 'USER',
      resourceId: userId,
      metadata: {
        ipAddress: this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null,
      },
    });

    this.logger.info('TOTP setup initiated', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId,
    });

    return { secret: secretRaw, otpAuthUri, qrCodeDataUrl };
  }
}
