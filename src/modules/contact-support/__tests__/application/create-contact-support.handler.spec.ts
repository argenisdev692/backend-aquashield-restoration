import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { CreateContactSupportHandler } from '../../application/commands/handlers/create-contact-support.handler';
import { CreateContactSupportCommand } from '../../application/commands/impl/create-contact-support.command';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../logger/logger.service';
import { ContactSupportCreatedEvent } from '../../domain/events/contact-support-created.domain-event';

const CMD = new CreateContactSupportCommand(
  'John',
  'Doe',
  'john@acme.com',
  '+1-555-0100',
  'Cannot log in',
  'I cannot log in to my account.',
  true,
  'actor-uuid',
);

describe('CreateContactSupportHandler', () => {
  let handler: CreateContactSupportHandler;
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
        CreateContactSupportHandler,
        { provide: CONTACT_SUPPORT_REPOSITORY, useValue: repo },
        { provide: AUDIT_PORT, useValue: audit },
        { provide: CACHE_PORT, useValue: cache },
        { provide: EventEmitter2, useValue: events },
        { provide: LoggerService, useValue: logger },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id-123') },
        },
      ],
    }).compile();

    handler = module.get(CreateContactSupportHandler);
  });

  it('creates, saves, audits, invalidates cache, emits event', async () => {
    const id = await handler.execute(CMD);

    expect(typeof id).toBe('string');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contact_support.created',
        resourceType: 'CONTACT',
        actorId: 'actor-uuid',
        resourceId: id,
      }),
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/contact-support*');
    expect(events.emit).toHaveBeenCalledWith(
      'contact-support.created',
      expect.any(ContactSupportCreatedEvent),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'CreateContactSupportHandler start',
      expect.objectContaining({ traceId: 'trace-id-123' }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'CreateContactSupportHandler end',
      expect.objectContaining({
        traceId: 'trace-id-123',
        contactSupportId: id,
      }),
    );
  });
});
