import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface';
import { maskEmail } from '../../../../../shared/utils/mask.util';
import { CheckEmailExistsQuery } from '../check-email-exists.query';

@QueryHandler(CheckEmailExistsQuery)
export class CheckEmailExistsHandler
  implements IQueryHandler<CheckEmailExistsQuery>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(query: CheckEmailExistsQuery): Promise<boolean> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CheckEmailExistsHandler', {
      traceId,
      email: maskEmail(query.email),
    });

    const user = await this.userRepo.findByEmail(query.email);
    if (!user) return false;

    if (query.excludeId && user.id.value === query.excludeId) {
      return false;
    }

    return true;
  }
}
