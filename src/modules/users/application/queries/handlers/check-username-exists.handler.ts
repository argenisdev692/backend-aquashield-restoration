import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface';
import { CheckUsernameExistsQuery } from '../check-username-exists.query';

@QueryHandler(CheckUsernameExistsQuery)
export class CheckUsernameExistsHandler
  implements IQueryHandler<CheckUsernameExistsQuery>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(query: CheckUsernameExistsQuery): Promise<boolean> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CheckUsernameExistsHandler', {
      traceId,
      username: query.username,
    });

    return this.userRepo.existsByUsername(query.username, query.excludeId);
  }
}
