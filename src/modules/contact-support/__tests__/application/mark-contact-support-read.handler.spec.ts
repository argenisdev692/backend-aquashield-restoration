jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { MarkContactSupportReadHandler } from '../../application/commands/handlers/mark-contact-support-read.handler';
import { MarkContactSupportReadCommand } from '../../application/commands/mark-contact-support-read.command';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../logger/logger.service';
import { ContactSupport } from '../../domain/entities/contact-support.aggregate';
import { ContactSupportReadEvent } from '../../domain/events/contact-support-read.domain-event';

const ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const CMD = new MarkContactSupportReadCommand(ID, 'admin-uuid');

function entity(): ContactSupport {
  return ContactSupport.create(
    ID,
    'John',
    'Doe',
    'john@acme.com',
    '+1-555-0100',
    'Help',
    'message body',
    false,
  );
}

describe('MarkContactSupportReadHandler', () => {
  let handler: MarkContactSupportReadHandler;
  let repo: { save: jest.Mock; findById: jest.Mock };
  let audit: { log: jest.Mock };
  let cache: { delByPattern: jest.Mock };
  let events: { emit: jest.Mock };
  let logger: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    cache = { delByPattern: jest.fn().mockResolvedValue(undefined) };
    events = { emit: jest.fn() };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarkContactSupportReadHandler,
        { provide: CONTACT_SUPPORT_REPOSITORY, useValue: repo },
        { provide: AUDIT_PORT, useValue: audit },
        { provide: CACHE_PORT, useValue: cache },
        { provide: EventEmitter2, useValue: events },
        { provide: LoggerService, useValue: logger },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
      ],
    }).compile();

    handler = module.get(MarkContactSupportReadHandler);
  });

  it('marks read, saves, audits, invalidates cache, emits read event', async () => {
    const e = entity();
    repo.findById.mockResolvedValue(e);

    await handler.execute(CMD);

    expect(e.readed).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(e);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contact_support.read',
        resourceType: 'CONTACT',
        actorId: 'admin-uuid',
        resourceId: ID,
      }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/contact-support*');
    expect(events.emit).toHaveBeenCalledWith(
      'contact-support.read',
      expect.any(ContactSupportReadEvent),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'MarkContactSupportReadHandler start',
      expect.objectContaining({ traceId: 'trace-id', id: ID }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'MarkContactSupportReadHandler end',
      expect.objectContaining({ traceId: 'trace-id', id: ID }),
    );
  });

  it('throws NotFound and skips side effects when missing', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(handler.execute(CMD)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(repo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(cache.delByPattern).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
