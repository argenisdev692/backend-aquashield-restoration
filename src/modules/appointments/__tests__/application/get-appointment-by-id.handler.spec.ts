import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { GetAppointmentByIdHandler } from '../../application/queries/handlers/get-appointment-by-id.handler';
import { GetAppointmentByIdQuery } from '../../application/queries/get-appointment-by-id.query';
import {
  APPOINTMENT_REPOSITORY,
  type IAppointmentRepository,
  type AppointmentReadModel,
} from '../../domain/repositories/appointment-repository.interface';
import { LoggerService } from '../../../../logger/logger.service';

const ID = '11111111-1111-1111-1111-111111111111';

const activeReadModel: AppointmentReadModel = {
  id: ID,
  firstName: 'A',
  lastName: 'B',
  phone: '+351912345678',
  email: null,
  address: 'Rua',
  address2: null,
  city: 'Lisboa',
  state: 'PT',
  zipcode: '1000-000',
  country: 'Portugal',
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
  isRead: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  status: 'active',
};

const suspendedReadModel: AppointmentReadModel = {
  ...activeReadModel,
  deletedAt: '2026-05-01T10:00:00.000Z',
  status: 'suspended',
};

describe('GetAppointmentByIdHandler — withTrashed', () => {
  let handler: GetAppointmentByIdHandler;
  let mockRepo: jest.Mocked<IAppointmentRepository>;

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAppointmentByIdHandler,
        { provide: APPOINTMENT_REPOSITORY, useValue: mockRepo },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), setContext: jest.fn() },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
      ],
    }).compile();

    handler = module.get(GetAppointmentByIdHandler);
  });

  it('forwards withTrashed=false by default', async () => {
    mockRepo.findReadModelById.mockResolvedValueOnce(activeReadModel);
    await handler.execute(new GetAppointmentByIdQuery(ID));
    expect(mockRepo.findReadModelById).toHaveBeenCalledWith(ID, false);
  });

  it('forwards withTrashed=true so suspended rows are visible', async () => {
    mockRepo.findReadModelById.mockResolvedValueOnce(suspendedReadModel);
    const result = await handler.execute(new GetAppointmentByIdQuery(ID, true));
    expect(mockRepo.findReadModelById).toHaveBeenCalledWith(ID, true);
    expect(result?.deletedAt).toBe('2026-05-01T10:00:00.000Z');
  });

  it('throws NotFoundException when the row is missing', async () => {
    mockRepo.findReadModelById.mockResolvedValueOnce(null);
    await expect(
      handler.execute(new GetAppointmentByIdQuery(ID, true)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
