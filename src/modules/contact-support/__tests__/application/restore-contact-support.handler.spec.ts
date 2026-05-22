jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { RestoreContactSupportHandler } from '../../application/commands/handlers/restore-contact-support.handler';
import { RestoreContactSupportCommand } from '../../application/commands/restore-contact-support.command';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../logger/logger.service';
import { ContactSupport } from '../../domain/entities/contact-support.aggregate';

const ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const CMD = new RestoreContactSupportCommand(ID, 'admin-uuid');

describe('RestoreContactSupportHandler', () => {
  let handler: RestoreContactSupportHandler;
  let repo: { save: jest.Mock; findByIdWithDeleted: jest.Mock };
  let audit: { log: jest.Mock };
  let cache: { delByPattern: jest.Mock };
  let logger: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      save: jest.fn().mockResolvedValue(undefined),
      findByIdWithDeleted: jest.fn(),
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
        RestoreContactSupportHandler,
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

    handler = module.get(RestoreContactSupportHandler);
  });

  it('restores a soft-deleted row, audits, invalidates cache, logs start+end', async () => {
    const e = ContactSupport.reconstitute(
      ID,
      'John',
      'Doe',
      'john@acme.com',
      '+1-555-0100',
      'Help',
      'message body',
      false,
      false,
      new Date('2026-01-01T00:00:00.000Z'),
    );
    repo.findByIdWithDeleted.mockResolvedValue(e);

    await handler.execute(CMD);

    expect(e.isDeleted).toBe(false);
    expect(repo.save).toHaveBeenCalledWith(e);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contact_support.restored',
        resourceType: 'CONTACT',
        actorId: 'admin-uuid',
        resourceId: ID,
      }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/contact-support*');
    expect(logger.info).toHaveBeenCalledWith(
      'RestoreContactSupportHandler start',
      expect.objectContaining({ traceId: 'trace-id', id: ID }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'RestoreContactSupportHandler end',
      expect.objectContaining({ traceId: 'trace-id', id: ID }),
    );
  });

  it('throws NotFound and skips side effects when missing', async () => {
    repo.findByIdWithDeleted.mockResolvedValue(null);
    await expect(handler.execute(CMD)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(cache.delByPattern).not.toHaveBeenCalled();
  });
});
