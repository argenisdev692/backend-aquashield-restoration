import { Inject, Injectable } from '@nestjs/common';
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
  ) {}

  async execute(id: string, withTrashed = true): Promise<RetellCallReadModel> {
    const call = await this.repo.findById(id, withTrashed);
    if (!call) throw new RetellCallNotFoundException(id);
    return call;
  }
}
