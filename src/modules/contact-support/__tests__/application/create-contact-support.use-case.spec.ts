jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { CreateContactSupportUseCase } from '../../application/use-cases/create-contact-support.use-case';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../logger/logger.service';
import { ContactSupportCreatedEvent } from '../../domain/events/contact-support-created.domain-event';
import type { CreateContactSupportDto } from '../../application/dtos/create-contact-support.dto';

const DTO: CreateContactSupportDto = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@acme.com',
  phone: '+1-555-0100',
  subject: 'Cannot log in',
  message: 'I cannot log in to my account.',
  smsConsent: true,
};
const ACTOR = 'actor-uuid';

describe('CreateContactSupportUseCase', () => {
  let useCase: CreateContactSupportUseCase;
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
        CreateContactSupportUseCase,
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

    useCase = module.get(CreateContactSupportUseCase);
  });

  it('creates, saves, audits, invalidates cache, emits event', async () => {
    const id = await useCase.execute(DTO, ACTOR);

    expect(typeof id).toBe('string');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contact_support.created',
        resourceType: 'CONTACT',
        actorId: ACTOR,
        resourceId: id,
      }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/contact-support*');
    expect(events.emit).toHaveBeenCalledWith(
      'contact-support.created',
      expect.any(ContactSupportCreatedEvent),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'CreateContactSupportUseCase start',
      expect.objectContaining({ traceId: 'trace-id-123' }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'CreateContactSupportUseCase end',
      expect.objectContaining({
        traceId: 'trace-id-123',
        contactSupportId: id,
      }),
    );
  });
});
