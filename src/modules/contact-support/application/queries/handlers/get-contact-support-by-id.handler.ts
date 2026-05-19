import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import { GetContactSupportByIdQuery } from '../impl/get-contact-support-by-id.query';
import { CONTACT_SUPPORT_REPOSITORY } from '../../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../../domain/ports/contact-support.repository.interface';
import type { ContactSupportReadModel } from '../../../domain/read-models/contact-support.read-model';

@QueryHandler(GetContactSupportByIdQuery)
export class GetContactSupportByIdHandler implements IQueryHandler<GetContactSupportByIdQuery> {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetContactSupportByIdHandler.name);
  }

  async execute(
    query: GetContactSupportByIdQuery,
  ): Promise<ContactSupportReadModel> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetContactSupportByIdHandler', { traceId, id: query.id });

    const result = await this.repo.findReadModelById(query.id);
    if (!result) throw new NotFoundException('Contact request not found');
    return result;
  }
}
