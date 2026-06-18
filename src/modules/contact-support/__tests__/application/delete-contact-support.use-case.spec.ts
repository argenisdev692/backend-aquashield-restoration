jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DeleteContactSupportUseCase } from '../../application/use-cases/delete-contact-support.use-case';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../logger/logger.service';
import { ContactSupport } from '../../domain/entities/contact-support.aggregate';

const ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const ACTOR = 'admin-uuid';

describe('DeleteContactSupportUseCase', () => {
  let useCase: DeleteContactSupportUseCase;
  let repo: { save: jest.Mock; findById: jest.Mock };
  let audit: { log: jest.Mock };
  let cache: { delByPattern: jest.Mock };
  let logger: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
    };
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
        DeleteContactSupportUseCase,
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

    useCase = module.get(DeleteContactSupportUseCase);
  });

  it('soft-deletes, audits, invalidates cache', async () => {
    const e = ContactSupport.create(
      ID,
      'John',
      'Doe',
      'john@acme.com',
      '+1-555-0100',
      'Help',
      'message body',
      false,
    );
    repo.findById.mockResolvedValue(e);

    await useCase.execute(ID, ACTOR);

    expect(e.isDeleted).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(e);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contact_support.deleted',
        resourceType: 'CONTACT',
        resourceId: ID,
      }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/contact-support*');
    expect(logger.info).toHaveBeenCalledWith(
      'DeleteContactSupportUseCase start',
      expect.objectContaining({ traceId: 'trace-id', id: ID }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'DeleteContactSupportUseCase end',
      expect.objectContaining({ traceId: 'trace-id', id: ID }),
    );
  });

  it('throws NotFound and skips side effects when missing', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute(ID, ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(cache.delByPattern).not.toHaveBeenCalled();
  });
});
