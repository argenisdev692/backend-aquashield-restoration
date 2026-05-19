import { Test, TestingModule } from '@nestjs/testing';
import { RestoreAppointmentUseCase } from '../../application/use-cases/restore-appointment.use-case';
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

describe('RestoreAppointmentUseCase', () => {
  let useCase: RestoreAppointmentUseCase;
  let mockRepo: jest.Mocked<IAppointmentRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;

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
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn().mockResolvedValue(undefined),
      markAsRead: jest.fn(),
    };
    mockAudit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestoreAppointmentUseCase,
        { provide: APPOINTMENT_REPOSITORY, useValue: mockRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-123') },
        },
      ],
    }).compile();

    useCase = module.get(RestoreAppointmentUseCase);
  });

  it('restores and audits', async () => {
    await useCase.execute('appt-1', 'user-9');

    expect(mockRepo.restore).toHaveBeenCalledWith('appt-1');
    expect(mockAudit.log).toHaveBeenCalledWith({
      action: 'appointments.restored',
      actorId: 'user-9',
      resourceId: 'appt-1',
      traceId: 'trace-123',
    });
  });

  it('throws and skips side effects when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('appt-1', 'user-9')).rejects.toThrow(
      'Appointment with id appt-1 not found',
    );
    expect(mockRepo.restore).not.toHaveBeenCalled();
    expect(mockAudit.log).not.toHaveBeenCalled();
  });
});
