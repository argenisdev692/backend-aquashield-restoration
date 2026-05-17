import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { UserReadModel } from '../read-models/user.read-model';

@Injectable()
export class GetUserByIdUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(id: string): Promise<UserReadModel | null> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetUserByIdUseCase', { traceId, userId: id });

    const user = await this.userRepo.findById(id);
    if (!user) return null;

    return {
      id: user.id.value,
      name: user.name,
      lastName: user.lastName,
      email: user.email.value,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordConfirmedAt: user.passwordConfirmedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
