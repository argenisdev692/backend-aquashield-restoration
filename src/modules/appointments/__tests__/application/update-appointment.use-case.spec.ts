jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UpdateAppointmentHandler } from '../../application/commands/handlers/update-appointment.handler';
import { UpdateAppointmentCommand } from '../../application/commands/update-appointment.command';
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

describe('UpdateAppointmentHandler', () => {
  let handler: UpdateAppointmentHandler;
  let mockRepo: jest.Mocked<IAppointmentRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockCache: jest.Mocked<ICachePort>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const appointment = Appointment.create({
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
    });

    mockRepo = {
      findById: jest.fn().mockResolvedValue(appointment),
      findReadModelById: jest.fn(),
      findIdByEmail: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn(),
      markAsRead: jest.fn(),
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
    mockEventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateAppointmentHandler,
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

    handler = module.get(UpdateAppointmentHandler);
  });

  it('updates, audits, invalidates cache, and emits', async () => {
    await handler.execute(
      new UpdateAppointmentCommand('appt-1', { firstName: 'Jane' }, 'user-123'),
    );

    expect(mockRepo.findById).toHaveBeenCalledWith('appt-1');
    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      {
        action: 'appointments.updated',
        actorId: 'user-123',
        resourceId: 'appt-1',
        traceId: 'trace-123',
      },
      { strict: true },
    );
    expect(mockCache.delByPattern).toHaveBeenCalledWith(
      'http:*:/appointments*',
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'appointment.updated',
      expect.any(Object),
    );
  });

  it('throws when appointment not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new UpdateAppointmentCommand(
          'missing',
          { firstName: 'Jane' },
          'user-123',
        ),
      ),
    ).rejects.toThrow('Appointment with id missing not found');
  });
});
