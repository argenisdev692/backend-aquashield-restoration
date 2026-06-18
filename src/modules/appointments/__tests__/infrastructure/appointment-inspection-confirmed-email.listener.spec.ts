import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { AppointmentInspectionConfirmedEmailListener } from '../../infrastructure/event-listeners/appointment-inspection-confirmed-email.listener';
import { InspectionConfirmedEvent } from '../../domain/events/inspection-confirmed.domain-event';
import {
  APPOINTMENT_REPOSITORY,
  type IAppointmentRepository,
} from '../../domain/repositories/appointment-repository.interface';
import {
  EMAIL_PORT,
  type IEmailPort,
} from '../../domain/ports/outbound/email.port.interface';
import {
  ADMIN_RECIPIENTS_PORT,
  type IAdminRecipientsPort,
} from '../../domain/ports/outbound/admin-recipients.port.interface';
import { Appointment } from '../../domain/entities/appointment.aggregate';
import { LoggerService } from '../../../../logger/logger.service';

function makeAppointment(): Appointment {
  return Appointment.create({
    firstName: 'John',
    lastName: 'Doe',
    phone: '5551234567',
    email: 'john@acme.test',
    address: '123 Main St',
    address2: null,
    city: 'Springfield',
    state: 'IL',
    zipcode: '62701',
    country: 'USA',
    insuranceProperty: true,
    message: null,
    smsConsent: false,
    registrationDate: null,
    inspectionDate: new Date('2026-01-05T00:00:00.000Z'),
    inspectionTime: new Date('1970-01-01T10:00:00.000Z'),
    inspectionStatus: 'Confirmed',
    statusLead: 'New',
    leadSource: 'Website',
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
}

describe('AppointmentInspectionConfirmedEmailListener', () => {
  let listener: AppointmentInspectionConfirmedEmailListener;
  let mockRepo: jest.Mocked<IAppointmentRepository>;
  let mockEmail: jest.Mocked<IEmailPort>;
  let mockAdmins: jest.Mocked<IAdminRecipientsPort>;

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(makeAppointment()),
    };
    mockEmail = {
      sendAppointmentConfirmed: jest.fn(),
      notifyAdminsAppointmentScheduled: jest.fn(),
    };
    mockAdmins = {
      getAdminRecipientEmails: jest.fn().mockResolvedValue(['admin@acme.test']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentInspectionConfirmedEmailListener,
        { provide: APPOINTMENT_REPOSITORY, useValue: mockRepo },
        { provide: EMAIL_PORT, useValue: mockEmail },
        { provide: ADMIN_RECIPIENTS_PORT, useValue: mockAdmins },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            setContext: jest.fn(),
          },
        },
        { provide: ClsService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    listener = module.get(AppointmentInspectionConfirmedEmailListener);
  });

  it('emails the client and notifies admins', async () => {
    await listener.handle(new InspectionConfirmedEvent('appt-1'));

    expect(mockEmail.sendAppointmentConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        appointment: expect.objectContaining({ email: 'john@acme.test' }),
      }),
    );
    expect(mockEmail.notifyAdminsAppointmentScheduled).toHaveBeenCalledWith(
      expect.objectContaining({ adminEmails: ['admin@acme.test'] }),
    );
  });

  it('skips silently when the appointment is gone', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await listener.handle(new InspectionConfirmedEvent('missing'));

    expect(mockEmail.sendAppointmentConfirmed).not.toHaveBeenCalled();
  });
});
