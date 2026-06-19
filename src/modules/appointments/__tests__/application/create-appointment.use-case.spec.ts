jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateAppointmentHandler } from '../../application/commands/handlers/create-appointment.handler';
import { CreateAppointmentCommand } from '../../application/commands/create-appointment.command';
import {
  IAppointmentRepository,
  APPOINTMENT_REPOSITORY,
} from '../../domain/repositories/appointment-repository.interface';
import {
  IAuditPort,
  AUDIT_PORT,
} from '../../domain/ports/outbound/audit.port.interface';
import {
  IEmailPort,
  EMAIL_PORT,
} from '../../domain/ports/outbound/email.port.interface';
import { CACHE_PORT, ICachePort } from '../../../../shared/cache/cache.port';
import { AppointmentCreatedEvent } from '../../domain/events/appointment-created.domain-event';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import type { z } from 'zod';
import { CreateAppointmentSchema } from '../../application/dtos/create-appointment.dto';

describe('CreateAppointmentHandler', () => {
  let handler: CreateAppointmentHandler;
  let mockRepo: jest.Mocked<IAppointmentRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockEmail: jest.Mocked<IEmailPort>;
  let mockCache: jest.Mocked<ICachePort>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCls: jest.Mocked<ClsService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  const baseDto: z.infer<typeof CreateAppointmentSchema> = {
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    email: 'john@example.com',
    address: '123 Main St',
    address2: null,
    city: 'Springfield',
    state: 'IL',
    zipcode: '62701',
    country: 'USA',
    insuranceProperty: false,
    message: null,
    smsConsent: false,
    registrationDate: null,
    inspectionDate: null,
    inspectionTime: null,
    inspectionStatus: null,
    statusLead: 'New',
    leadSource: null,
    followUpCalls: null,
    notes: null,
    owner: null,
    damageDetail: null,
    intentToClaim: null,
    followUpDate: null,
    additionalNote: null,
    latitude: null,
    longitude: null,
  };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      findReadModelById: jest.fn(),
      findIdByEmail: jest.fn().mockResolvedValue(null),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn(),
      markAsRead: jest.fn(),
      bulkDelete: jest.fn(),
      bulkRestore: jest.fn(),
    };
    mockAudit = { log: jest.fn() };
    mockEmail = {
      sendEmail: jest.fn(),
      notifyAdminsNewLead: jest.fn(),
      sendSubmissionConfirmation: jest.fn(),
    };
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    };
    mockCls = {
      get: jest.fn().mockReturnValue('trace-123'),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateAppointmentHandler,
        { provide: APPOINTMENT_REPOSITORY, useValue: mockRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: EMAIL_PORT, useValue: mockEmail },
        { provide: CACHE_PORT, useValue: mockCache },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    handler = module.get(CreateAppointmentHandler);
  });

  it('creates an appointment, audits, invalidates cache, and emits', async () => {
    const id = await handler.execute(
      new CreateAppointmentCommand(baseDto, 'user-123'),
    );

    expect(id).toEqual(expect.any(String));
    expect(mockRepo.findIdByEmail).toHaveBeenCalledWith('john@example.com');
    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      {
        action: 'appointments.created',
        actorId: 'user-123',
        resourceId: expect.any(String),
        traceId: 'trace-123',
      },
      { strict: true },
    );
    expect(mockCache.delByPattern).toHaveBeenCalledWith(
      'http:*:/appointments*',
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'appointment.created',
      expect.any(AppointmentCreatedEvent),
    );
  });

  it('returns existing id on duplicate email, no save, no PII in audit', async () => {
    mockRepo.findIdByEmail.mockResolvedValue('existing-id');

    const id = await handler.execute(
      new CreateAppointmentCommand(baseDto, 'user-123'),
    );

    expect(id).toBe('existing-id');
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockEmail.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'john@example.com' }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      {
        action: 'appointments.duplicate_email_prevented',
        actorId: 'user-123',
        resourceId: 'existing-id',
        traceId: 'trace-123',
      },
      { strict: false },
    );
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('does not log PII at INFO start', async () => {
    await handler.execute(new CreateAppointmentCommand(baseDto, 'user-123'));

    const infoCalls = mockLogger.info.mock.calls.map(
      ([, payload]) => payload as Record<string, unknown>,
    );
    for (const payload of infoCalls) {
      expect(payload).not.toHaveProperty('email');
      expect(payload).not.toHaveProperty('firstName');
      expect(payload).not.toHaveProperty('lastName');
    }
  });
});
