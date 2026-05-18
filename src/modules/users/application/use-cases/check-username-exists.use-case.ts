import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';

@Injectable()
export class CheckUsernameExistsUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(username: string, excludeId?: string): Promise<boolean> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CheckUsernameExistsUseCase', { traceId, username });
    return this.userRepo.existsByUsername(username, excludeId);
  }
}
