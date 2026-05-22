import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { GetAppointmentsListHandler } from '../../application/queries/handlers/get-appointments-list.handler';
import { GetAppointmentsListQuery } from '../../application/queries/get-appointments-list.query';
import {
  APPOINTMENT_REPOSITORY,
  type IAppointmentRepository,
} from '../../domain/repositories/appointment-repository.interface';
import { LoggerService } from '../../../../logger/logger.service';

describe('GetAppointmentsListHandler — trashed semantics', () => {
  let handler: GetAppointmentsListHandler;
  let mockRepo: jest.Mocked<IAppointmentRepository>;

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      findReadModelById: jest.fn(),
      findIdByEmail: jest.fn(),
      findAll: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
      save: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn(),
      markAsRead: jest.fn(),
      bulkDelete: jest.fn(),
      bulkRestore: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAppointmentsListHandler,
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

    handler = module.get(GetAppointmentsListHandler);
  });

  const baseDto = { page: 1, limit: 20 };

  it('forwards trashed=exclude when no flag is passed (default)', async () => {
    await handler.execute(new GetAppointmentsListQuery(baseDto));
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'exclude' }),
    );
  });

  it('forwards trashed=include when withTrashed=true', async () => {
    await handler.execute(
      new GetAppointmentsListQuery({ ...baseDto, withTrashed: true }),
    );
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'include' }),
    );
  });

  it('forwards trashed=only when onlyTrashed=true', async () => {
    await handler.execute(
      new GetAppointmentsListQuery({ ...baseDto, onlyTrashed: true }),
    );
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'only' }),
    );
  });
});
