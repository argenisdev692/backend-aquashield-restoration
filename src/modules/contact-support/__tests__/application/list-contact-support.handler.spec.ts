import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { ListContactSupportHandler } from '../../application/queries/handlers/list-contact-support.handler';
import { ListContactSupportQuery } from '../../application/queries/impl/list-contact-support.query';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../logger/logger.service';

describe('ListContactSupportHandler', () => {
  let handler: ListContactSupportHandler;
  let repo: { findMany: jest.Mock };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    repo = {
      findMany: jest
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 }),
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListContactSupportHandler,
        { provide: CONTACT_SUPPORT_REPOSITORY, useValue: repo },
        { provide: AUDIT_PORT, useValue: audit },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), setContext: jest.fn() },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
      ],
    }).compile();

    handler = module.get(ListContactSupportHandler);
  });

  it('forwards pagination + readed filter to the repository', async () => {
    const result = await handler.execute(
      new ListContactSupportQuery(2, 10, false),
    );

    expect(repo.findMany).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      readed: false,
    });
    expect(result).toEqual({ data: [], total: 0, page: 2, limit: 10 });
  });

  it('never audits (read path)', async () => {
    await handler.execute(new ListContactSupportQuery(1, 20));
    expect(audit.log).not.toHaveBeenCalled();
  });
});
