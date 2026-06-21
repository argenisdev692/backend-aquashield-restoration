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
import { CompanyBrandingService } from '../../../companydata/company-branding.service';

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
        {
          provide: CompanyBrandingService,
          useValue: { getFallbackName: () => 'Company' },
        },
      ],
    }).compile();

    handler = module.get(ExportAppointmentsHandler);
  });

  const fmt = 'xlsx' as const;
  const baseDto = { format: fmt };
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

  describe('format-specific buffers', () => {
    const row = {
      id: '11111111-1111-1111-1111-111111111111',
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
      message: 'Need a quote',
      smsConsent: true,
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
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    };

    beforeEach(() => {
      mockRepo.findAll.mockResolvedValue({
        data: [row],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('csv → text/csv with UTF-8 BOM and header row', async () => {
      const res = await handler.execute(
        new ExportAppointmentsQuery({ format: 'csv' }, 'csv', actor),
      );
      expect(res.contentType).toBe('text/csv; charset=utf-8');
      expect(res.filename).toMatch(/^appointments-.+\.csv$/);
      // BOM
      expect(res.buffer.slice(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      const csv = res.buffer.slice(3).toString('utf8');
      expect(csv.split('\r\n')[0]).toContain('id,firstName,lastName');
      expect(csv).toContain('John');
    });

    it('xlsx → spreadsheetml MIME with ZIP magic bytes', async () => {
      const res = await handler.execute(
        new ExportAppointmentsQuery({ format: 'xlsx' }, 'xlsx', actor),
      );
      expect(res.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.filename).toMatch(/^appointments-.+\.xlsx$/);
      // XLSX is a ZIP container → starts with "PK\x03\x04".
      expect(res.buffer.slice(0, 4)).toEqual(
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      );
    });

    it('pdf → application/pdf with %PDF magic header', async () => {
      const res = await handler.execute(
        new ExportAppointmentsQuery({ format: 'pdf' }, 'pdf', actor),
      );
      expect(res.contentType).toBe('application/pdf');
      expect(res.filename).toMatch(/^appointments-.+\.pdf$/);
      expect(res.buffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('csv defuses formula injection by prefixing dangerous cells', async () => {
      mockRepo.findAll.mockResolvedValue({
        data: [{ ...row, firstName: '=cmd|"/c calc"!A1' }],
        total: 1,
        page: 1,
        limit: 20,
      });
      const res = await handler.execute(
        new ExportAppointmentsQuery({ format: 'csv' }, 'csv', actor),
      );
      const csv = res.buffer.slice(3).toString('utf8');
      expect(csv).toContain('"\'=cmd|""/c calc""!A1"');
    });
  });
});
