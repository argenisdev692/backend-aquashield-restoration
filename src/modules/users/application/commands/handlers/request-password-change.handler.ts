import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface';
import type { IPasswordSetupRepository } from '../../../domain/repositories/password-setup.repository.interface';
import { PASSWORD_SETUP_REPOSITORY } from '../../../domain/repositories/password-setup.repository.interface';
import type { IEmailPort } from '../../../domain/ports/outbound/email.port';
import { EMAIL_PORT } from '../../../domain/ports/outbound/email.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import { SetupToken } from '../../../domain/value-objects/setup-token.vo';
import { RequestPasswordChangeCommand } from '../request-password-change.command';

const CHANGE_TOKEN_TTL_MS = 72 * 60 * 60 * 1_000;

interface RequestChangeTxResult {
  userId: string;
  rawToken: string;
  userName: string;
}

@CommandHandler(RequestPasswordChangeCommand)
export class RequestPasswordChangeHandler
  implements ICommandHandler<RequestPasswordChangeCommand>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_SETUP_REPOSITORY)
    private readonly setupRepo: IPasswordSetupRepository,
    @Inject(EMAIL_PORT)
    private readonly emailPort: IEmailPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(command: RequestPasswordChangeCommand): Promise<void> {
    const { dto } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RequestPasswordChangeHandler start', {
      traceId,
      email: dto.email,
    });

    const result = await this.runWrite(command);

    // Silent return when email is unknown — DO NOT reveal existence.
    if (!result) {
      this.logger.info('Password change — email not found (silent)', {
        traceId,
      });
      return;
    }

    // Email sending is a remote side-effect — MUST happen after tx commits.
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const setupLink = `${appUrl}/users/change-password?token=${result.rawToken}`;
    await this.emailPort.sendPasswordSetupLink({
      to: dto.email,
      setupLink,
      name: result.userName,
      type: 'change',
    });

    this.logger.info('RequestPasswordChangeHandler end', {
      traceId,
      userId: result.userId,
    });
  }

  @Transactional()
  private async runWrite(
    command: RequestPasswordChangeCommand,
  ): Promise<RequestChangeTxResult | null> {
    const { dto } = command;

    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) return null;

    await this.setupRepo.invalidateAllForUser(user.id.value, 'change');

    const token = SetupToken.generate();
    const expiresAt = new Date(Date.now() + CHANGE_TOKEN_TTL_MS);
    await this.setupRepo.save({
      userId: user.id.value,
      token,
      type: 'change',
      expiresAt,
    });

    await this.audit.log(
      {
        action: 'users.password_change_requested',
        resourceType: 'USER',
        resourceId: user.id.value,
      },
      { strict: true },
    );

    return {
      userId: user.id.value,
      rawToken: token.raw,
      userName: user.name,
    };
  }
}
