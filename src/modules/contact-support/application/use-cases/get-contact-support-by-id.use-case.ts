import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../domain/ports/contact-support.repository.interface';
import type { ContactSupportReadModel } from '../../domain/read-models/contact-support.read-model';

@Injectable()
export class GetContactSupportByIdUseCase {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetContactSupportByIdUseCase.name);
  }

  async execute(
    id: string,
    withTrashed: boolean,
  ): Promise<ContactSupportReadModel> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetContactSupportByIdUseCase', {
      traceId,
      id,
      withTrashed,
    });

    const result = await this.repo.findReadModelById(id, withTrashed);
    if (!result) throw new NotFoundException('Contact request not found');
    return result;
  }
}
