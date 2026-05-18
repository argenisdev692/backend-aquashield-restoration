import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeleteAppointmentUseCase } from '../../application/use-cases/delete-appointment.use-case';
import {
  IAppointmentRepository,
  APPOINTMENT_REPOSITORY,
} from '../../domain/repositories/appointment-repository.interface';
import {
  IAuditPort,
  AUDIT_PORT,
} from '../../domain/ports/outbound/audit.port.interface';
import { Appointment } from '../../domain/entities/appointment.aggregate';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

describe('DeleteAppointmentUseCase', () => {
  let useCase: DeleteAppointmentUseCase;
  let mockRepo: jest.Mocked<IAppointmentRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCls: jest.Mocked<ClsService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockAppointment = Appointment.create({
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
      findById: jest.fn().mockResolvedValue(mockAppointment),
      findReadModelById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
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
        DeleteAppointmentUseCase,
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

    useCase = module.get<DeleteAppointmentUseCase>(DeleteAppointmentUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should delete an appointment and log audit', async () => {
    mockCls.get.mockReturnValue('trace-123');
    mockRepo.delete.mockResolvedValue(undefined);

    await useCase.execute('appointment-123', 'user-123');

    expect(mockRepo.findById).toHaveBeenCalledWith('appointment-123');
    expect(mockRepo.delete).toHaveBeenCalledWith('appointment-123');
    expect(mockAudit.log).toHaveBeenCalledWith({
      action: 'appointments.deleted',
      actorId: 'user-123',
      resourceId: 'appointment-123',
      traceId: 'trace-123',
    });
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'appointment.deleted',
      expect.any(Object),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'DeleteAppointmentUseCase start',
      expect.any(Object),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'DeleteAppointmentUseCase end',
      expect.any(Object),
    );
  });

  it('should throw error when appointment not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('appointment-123', 'user-123'),
    ).rejects.toThrow('Appointment with id appointment-123 not found');
  });
});
