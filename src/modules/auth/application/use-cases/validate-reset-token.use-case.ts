import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IPasswordResetRepository } from '../../domain/repositories/password-reset.repository.interface';
import { PASSWORD_RESET_REPOSITORY } from '../../domain/repositories/password-reset.repository.interface';
import { ResetToken } from '../../domain/value-objects/reset-token.vo';

export interface ResetTokenValidation {
  valid: boolean;
}

@Injectable()
export class ValidateResetTokenUseCase {
  constructor(
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly resetRepo: IPasswordResetRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ValidateResetTokenUseCase.name);
  }

  async execute(rawToken: string): Promise<ResetTokenValidation> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Validate reset token', { traceId });

    const hash = ResetToken.hashOf(rawToken);
    const row = await this.resetRepo.findValid(hash);
    return { valid: row !== null };
  }
}
