import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';

const CONFIRMATION_WINDOW_MS = 3 * 60 * 60 * 1_000; // 3 hours

export interface PasswordConfirmationStatus {
  confirmed: boolean;
  confirmedAt: Date | null;
}

@Injectable()
export class GetPasswordConfirmationStatusUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetPasswordConfirmationStatusUseCase.name);
  }

  async execute(userId: string): Promise<PasswordConfirmationStatus> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetPasswordConfirmationStatus', { traceId, userId });

    const confirmedAt = await this.userRepo.getPasswordConfirmedAt(userId);
    if (confirmedAt === null) {
      return { confirmed: false, confirmedAt: null };
    }

    const confirmed =
      Date.now() - confirmedAt.getTime() < CONFIRMATION_WINDOW_MS;
    return { confirmed, confirmedAt };
  }
}
