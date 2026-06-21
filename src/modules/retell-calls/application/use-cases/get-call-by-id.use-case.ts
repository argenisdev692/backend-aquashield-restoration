import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
  type RetellCallReadModel,
} from '../../domain/repositories/retell-call-repository.interface';
import { RetellCallNotFoundException } from '../../domain/exceptions/retell-call-domain.exception';

@Injectable()
export class GetCallByIdUseCase {
  constructor(
    @Inject(RETELL_CALL_REPOSITORY)
    private readonly repo: IRetellCallRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetCallByIdUseCase.name);
  }

  async execute(id: string, withTrashed = true): Promise<RetellCallReadModel> {
    this.logger.info('Fetching Retell call', {
      traceId: this.cls.get<string>('traceId'),
      id,
      withTrashed,
    });
    const call = await this.repo.findById(id, withTrashed);
    if (!call) throw new RetellCallNotFoundException(id);
    return call;
  }
}
