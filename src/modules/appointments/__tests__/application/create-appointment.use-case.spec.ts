import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateAppointmentUseCase } from '../../application/use-cases/create-appointment.use-case';
import {
  IAppointmentRepository,
  APPOINTMENT_REPOSITORY,
} from '../../domain/repositories/appointment-repository.interface';
import {
  IAuditPort,
  AUDIT_PORT,
} from '../../domain/ports/outbound/audit.port.interface';
import { AppointmentCreatedEvent } from '../../domain/events/appointment-created.domain-event';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import type { z } from 'zod';
import { CreateAppointmentSchema } from '../../application/dtos/create-appointment.dto';

describe('CreateAppointmentUseCase', () => {
  let useCase: CreateAppointmentUseCase;
  let mockRepo: jest.Mocked<IAppointmentRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCls: jest.Mocked<ClsService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      findReadModelById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn(),
      markAsRead: jest.fn(),
    };

    mockAudit = {
      log: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockCls = {
      get: jest.fn(),
    } as any;

    mockEventEmitter = {
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateAppointmentUseCase,
        {
          provide: APPOINTMENT_REPOSITORY,
          useValue: mockRepo,
        },
        {
          provide: AUDIT_PORT,
          useValue: mockAudit,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
        {
          provide: ClsService,
          useValue: mockCls,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    useCase = module.get<CreateAppointmentUseCase>(CreateAppointmentUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should create an appointment and log audit', async () => {
    mockCls.get.mockReturnValue('trace-123');
    mockRepo.save.mockResolvedValue(undefined);

    const dto: z.infer<typeof CreateAppointmentSchema> = {
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
    };

    const result = await useCase.execute(dto, 'user-123');

    expect(result).toBeDefined();
    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith({
      action: 'appointments.created',
      actorId: 'user-123',
      resourceId: expect.any(String),
      traceId: 'trace-123',
    });
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'appointment.created',
      expect.any(AppointmentCreatedEvent),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'CreateAppointmentUseCase start',
      expect.any(Object),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'CreateAppointmentUseCase end',
      expect.any(Object),
    );
  });
});
