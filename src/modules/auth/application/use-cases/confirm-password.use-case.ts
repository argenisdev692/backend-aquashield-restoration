import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ConfirmPasswordInput } from '../dtos/confirm-password.dto';

@Injectable()
export class ConfirmPasswordUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ConfirmPasswordUseCase.name);
  }

  async execute(userId: string, dto: ConfirmPasswordInput): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ConfirmPassword start', { traceId, userId });

    const user = await this.userRepo.findById(userId);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.passwordHasher.compare(dto.password, user.password);
    if (!valid) {
      await this.audit.log({
        action: 'auth.password_confirm_failed',
        resourceType: 'USER',
        resourceId: userId,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.userRepo.setPasswordConfirmed(userId);

    await this.audit.log({
      action: 'auth.password_confirmed',
      resourceType: 'USER',
      resourceId: userId,
    });

    this.logger.info('Password confirmed', { traceId, userId });
  }
}
