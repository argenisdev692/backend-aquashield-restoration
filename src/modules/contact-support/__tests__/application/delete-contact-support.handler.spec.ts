import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DeleteContactSupportHandler } from '../../application/commands/handlers/delete-contact-support.handler';
import { DeleteContactSupportCommand } from '../../application/commands/impl/delete-contact-support.command';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../logger/logger.service';
import { ContactSupport } from '../../domain/entities/contact-support.aggregate';

const ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const CMD = new DeleteContactSupportCommand(ID, 'admin-uuid');

describe('DeleteContactSupportHandler', () => {
  let handler: DeleteContactSupportHandler;
  let repo: { save: jest.Mock; findById: jest.Mock };
  let audit: { log: jest.Mock };
  let cache: { delByPattern: jest.Mock };

  beforeEach(async () => {
    repo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    cache = { delByPattern: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteContactSupportHandler,
        { provide: CONTACT_SUPPORT_REPOSITORY, useValue: repo },
        { provide: AUDIT_PORT, useValue: audit },
        { provide: CACHE_PORT, useValue: cache },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            setContext: jest.fn(),
          },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
      ],
    }).compile();

    handler = module.get(DeleteContactSupportHandler);
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

    await handler.execute(CMD);

    expect(e.isDeleted).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(e);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contact_support.deleted',
        resourceType: 'CONTACT',
        resourceId: ID,
      }),
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/contact-support*');
  });

  it('throws NotFound and skips side effects when missing', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(handler.execute(CMD)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(cache.delByPattern).not.toHaveBeenCalled();
  });
});
