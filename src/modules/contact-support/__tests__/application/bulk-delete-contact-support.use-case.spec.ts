jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { BulkDeleteContactSupportUseCase } from '../../application/use-cases/bulk-delete-contact-support.use-case';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../logger/logger.service';

const IDS = [
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000003',
];
const ACTOR = 'admin-uuid';

describe('BulkDeleteContactSupportUseCase', () => {
  let useCase: BulkDeleteContactSupportUseCase;
  let repo: { bulkDelete: jest.Mock };
  let audit: { log: jest.Mock };
  let cache: { delByPattern: jest.Mock };
  let logger: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = { bulkDelete: jest.fn().mockResolvedValue({ count: 3 }) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    cache = { delByPattern: jest.fn().mockResolvedValue(undefined) };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkDeleteContactSupportUseCase,
        { provide: CONTACT_SUPPORT_REPOSITORY, useValue: repo },
        { provide: AUDIT_PORT, useValue: audit },
        { provide: CACHE_PORT, useValue: cache },
        { provide: LoggerService, useValue: logger },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
      ],
    }).compile();

    useCase = module.get(BulkDeleteContactSupportUseCase);
  });

  it('bulk soft-deletes via a single repo call, emits one audit row, invalidates cache once', async () => {
    const result = await useCase.execute(IDS, ACTOR);

    expect(repo.bulkDelete).toHaveBeenCalledTimes(1);
    expect(repo.bulkDelete).toHaveBeenCalledWith(IDS);
    expect(result).toEqual({ count: 3 });
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contact_support.bulk_deleted',
        actorId: ACTOR,
        resourceType: 'CONTACT',
        metadata: { ids: IDS, count: 3 },
      }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledTimes(1);
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/contact-support*');
    expect(logger.info).toHaveBeenCalledWith(
      'BulkDeleteContactSupportUseCase start',
      expect.objectContaining({ traceId: 'trace-id', idsCount: 3 }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'BulkDeleteContactSupportUseCase end',
      expect.objectContaining({ traceId: 'trace-id', count: 3 }),
    );
  });

  it('sets resourceId when only one id was sent', async () => {
    repo.bulkDelete.mockResolvedValueOnce({ count: 1 });
    const oneId = [IDS[0]];

    await useCase.execute(oneId, ACTOR);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: IDS[0] }),
      { strict: true },
    );
  });
});
