jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MarkAppointmentReadHandler } from '../../application/commands/handlers/mark-appointment-read.handler';
import { MarkAppointmentReadCommand } from '../../application/commands/mark-appointment-read.command';
import {
  IAppointmentRepository,
  APPOINTMENT_REPOSITORY,
} from '../../domain/repositories/appointment-repository.interface';
import {
  IAuditPort,
  AUDIT_PORT,
} from '../../domain/ports/outbound/audit.port.interface';
import { CACHE_PORT, ICachePort } from '../../../../shared/cache/cache.port';
import { Appointment } from '../../domain/entities/appointment.aggregate';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

describe('MarkAppointmentReadHandler', () => {
  let handler: MarkAppointmentReadHandler;
  let mockRepo: jest.Mocked<IAppointmentRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockCache: jest.Mocked<ICachePort>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const appointment = Appointment.create({
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      email: null,
      address: '123 Main St',
      address2: null,
      city: 'Springfield',
      state: 'IL',
      zipcode: '62701',
      country: 'USA',
      message: null,
      smsConsent: false,
      registrationDate: null,
      statusLead: 'New',
      followUpCalls: null,
      notes: null,
      owner: null,
      additionalNote: null,
      latitude: null,
      longitude: null,
    });

    mockRepo = {
      findById: jest.fn().mockResolvedValue(appointment),
      findReadModelById: jest.fn(),
      findIdByEmail: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn(),
      markAsRead: jest.fn().mockResolvedValue(undefined),
      bulkDelete: jest.fn(),
      bulkRestore: jest.fn(),
    };
    mockAudit = { log: jest.fn() };
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
    };
    mockEventEmitter = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarkAppointmentReadHandler,
        { provide: APPOINTMENT_REPOSITORY, useValue: mockRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: CACHE_PORT, useValue: mockCache },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            setContext: jest.fn(),
          },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-123') },
        },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    handler = module.get(MarkAppointmentReadHandler);
  });

  it('marks as read, audits with appointments.read, invalidates cache, emits', async () => {
    await handler.execute(new MarkAppointmentReadCommand('appt-1', 'user-9'));

    expect(mockRepo.findById).toHaveBeenCalledWith('appt-1');
    expect(mockRepo.markAsRead).toHaveBeenCalledWith('appt-1');
    expect(mockAudit.log).toHaveBeenCalledWith(
      {
        action: 'appointments.read',
        actorId: 'user-9',
        resourceId: 'appt-1',
        traceId: 'trace-123',
      },
      { strict: true },
    );
    expect(mockCache.delByPattern).toHaveBeenCalledWith('http:*:/appointments*');
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'appointment.read',
      expect.any(Object),
    );
  });

  it('throws and skips side effects when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new MarkAppointmentReadCommand('appt-1', 'user-9')),
    ).rejects.toThrow('Appointment with id appt-1 not found');

    expect(mockRepo.markAsRead).not.toHaveBeenCalled();
    expect(mockAudit.log).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });
});
