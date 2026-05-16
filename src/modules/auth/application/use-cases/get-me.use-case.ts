import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository, UserProfileRow } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';

@Injectable()
export class GetMeUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetMeUseCase.name);
  }

  async execute(userId: string): Promise<UserProfileRow> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetMe', { traceId, userId });

    const profile = await this.userRepo.findProfileById(userId);
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    return profile;
  }
}
