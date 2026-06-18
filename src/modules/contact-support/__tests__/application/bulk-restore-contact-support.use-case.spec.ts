jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { BulkRestoreContactSupportUseCase } from '../../application/use-cases/bulk-restore-contact-support.use-case';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../logger/logger.service';

const IDS = [
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
];
const ACTOR = 'admin-uuid';

describe('BulkRestoreContactSupportUseCase', () => {
  let useCase: BulkRestoreContactSupportUseCase;
  let repo: { bulkRestore: jest.Mock };
  let audit: { log: jest.Mock };
  let cache: { delByPattern: jest.Mock };
  let logger: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = { bulkRestore: jest.fn().mockResolvedValue({ count: 2 }) };
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
        BulkRestoreContactSupportUseCase,
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

    useCase = module.get(BulkRestoreContactSupportUseCase);
  });

  it('bulk-restores via a single repo call, emits one audit row, invalidates cache once', async () => {
    const result = await useCase.execute(IDS, ACTOR);

    expect(repo.bulkRestore).toHaveBeenCalledTimes(1);
    expect(repo.bulkRestore).toHaveBeenCalledWith(IDS);
    expect(result).toEqual({ count: 2 });
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contact_support.bulk_restored',
        actorId: ACTOR,
        resourceType: 'CONTACT',
        metadata: { ids: IDS, count: 2 },
      }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledTimes(1);
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/contact-support*');
    expect(logger.info).toHaveBeenCalledWith(
      'BulkRestoreContactSupportUseCase start',
      expect.objectContaining({ traceId: 'trace-id', idsCount: 2 }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'BulkRestoreContactSupportUseCase end',
      expect.objectContaining({ traceId: 'trace-id', count: 2 }),
    );
  });
});
