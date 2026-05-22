import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { ExportAppointmentsHandler } from '../../application/queries/handlers/export-appointments.handler';
import { ExportAppointmentsQuery } from '../../application/queries/export-appointments.query';
import {
  APPOINTMENT_REPOSITORY,
  type IAppointmentRepository,
} from '../../domain/repositories/appointment-repository.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../domain/ports/outbound/audit.port.interface';
import { LoggerService } from '../../../../logger/logger.service';

describe('ExportAppointmentsHandler — trashed semantics', () => {
  let handler: ExportAppointmentsHandler;
  let mockRepo: jest.Mocked<IAppointmentRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;

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
    mockAudit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportAppointmentsHandler,
        { provide: APPOINTMENT_REPOSITORY, useValue: mockRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
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

    handler = module.get(ExportAppointmentsHandler);
  });

  const baseDto = { page: 1, limit: 20 };
  const fmt = 'xlsx' as const;
  const actor = 'actor-1';

  it('forwards trashed=exclude when no flag is passed', async () => {
    await handler.execute(new ExportAppointmentsQuery(baseDto, fmt, actor));
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'exclude' }),
    );
  });

  it('forwards trashed=include when withTrashed=true', async () => {
    await handler.execute(
      new ExportAppointmentsQuery(
        { ...baseDto, withTrashed: true },
        fmt,
        actor,
      ),
    );
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'include' }),
    );
  });

  it('forwards trashed=only when onlyTrashed=true (audit report of suspended)', async () => {
    await handler.execute(
      new ExportAppointmentsQuery(
        { ...baseDto, onlyTrashed: true },
        fmt,
        actor,
      ),
    );
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'only' }),
    );
  });

  it('always audits the export, regardless of trashed flag', async () => {
    await handler.execute(
      new ExportAppointmentsQuery(
        { ...baseDto, onlyTrashed: true },
        fmt,
        actor,
      ),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'appointments.export',
        actorId: actor,
      }),
      expect.anything(),
    );
  });
});
