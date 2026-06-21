import { Test, TestingModule } from '@nestjs/testing';
import { ExportCallsUseCase } from '../application/use-cases/export-calls.use-case';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
} from '../domain/repositories/retell-call-repository.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../domain/ports/outbound/audit.port.interface';
import { ExportService } from '../../../shared/export/export.service';
import { LoggerService } from '../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import type { ExportCallsInput } from '../application/dtos/export-calls.dto';

describe('ExportCallsUseCase', () => {
  let useCase: ExportCallsUseCase;
  let repo: jest.Mocked<IRetellCallRepository>;
  let audit: jest.Mocked<IAuditPort>;
  let exporter: { generate: jest.Mock };

  beforeEach(async () => {
    repo = {
      upsertByCallId: jest.fn(),
      findById: jest.fn(),
      paginate: jest.fn(),
      findForExport: jest.fn().mockResolvedValue([]),
      markRead: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      bulkSoftDelete: jest.fn(),
      bulkRestore: jest.fn(),
    };
    audit = { log: jest.fn() };
    exporter = { generate: jest.fn().mockResolvedValue(Buffer.from('id,callId\n')) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportCallsUseCase,
        { provide: RETELL_CALL_REPOSITORY, useValue: repo },
        { provide: AUDIT_PORT, useValue: audit },
        { provide: ExportService, useValue: exporter },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn() },
        },
        { provide: ClsService, useValue: { get: jest.fn().mockReturnValue('trace-1') } },
      ],
    }).compile();

    useCase = module.get(ExportCallsUseCase);
  });

  it('builds a CSV via the shared exporter and audits the export', async () => {
    const dto = { format: 'csv' } as ExportCallsInput;

    const result = await useCase.execute(dto, 'user-1');

    expect(exporter.generate).toHaveBeenCalledWith(
      expect.objectContaining({ sheetName: 'Call Records' }),
      'csv',
    );
    expect(result.contentType).toBe('text/csv; charset=utf-8');
    expect(result.filename).toMatch(/^call-records-.*\.csv$/);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'call-records.export' }),
      { strict: false },
    );
  });
});
