import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { ListContactSupportUseCase } from '../../application/use-cases/list-contact-support.use-case';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../logger/logger.service';

describe('ListContactSupportUseCase', () => {
  let useCase: ListContactSupportUseCase;
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
        ListContactSupportUseCase,
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

    useCase = module.get(ListContactSupportUseCase);
  });

  it('forwards pagination + isRead filter to the repository', async () => {
    const result = await useCase.execute({
      page: 2,
      limit: 10,
      isRead: false,
      trashed: 'exclude',
    });

    expect(repo.findMany).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      isRead: false,
      trashed: 'exclude',
    });
    expect(result).toEqual({ data: [], total: 0, page: 2, limit: 10 });
  });

  it('never audits (read path)', async () => {
    await useCase.execute({ page: 1, limit: 20, trashed: 'exclude' });
    expect(audit.log).not.toHaveBeenCalled();
  });

  describe('trashed semantics', () => {
    it('forwards trashed=exclude (only active rows)', async () => {
      await useCase.execute({ page: 1, limit: 20, trashed: 'exclude' });
      expect(repo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ trashed: 'exclude' }),
      );
    });

    it('forwards trashed=include for Laravel withTrashed()', async () => {
      await useCase.execute({ page: 1, limit: 20, trashed: 'include' });
      expect(repo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ trashed: 'include' }),
      );
    });

    it('forwards trashed=only for Laravel onlyTrashed()', async () => {
      await useCase.execute({ page: 1, limit: 20, trashed: 'only' });
      expect(repo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ trashed: 'only' }),
      );
    });
  });
});
