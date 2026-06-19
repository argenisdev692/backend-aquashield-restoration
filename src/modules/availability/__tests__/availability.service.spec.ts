import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AvailabilityService } from '../availability.service';
import type { AvailabilityRepository } from '../availability.repository';
import type { CacheService } from '../../../shared/cache/cache.service';
import type { LoggerService } from '../../../logger/logger.service';
import type { ExportService } from '../../../shared/export/export.service';
import type { ClsService } from 'nestjs-cls';
import type { IAuditPort } from '../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../shared/database/transaction-manager.port';

const makeRule = (overrides = {}) => ({
  id: 'rule-id',
  dayOfWeek: 1,
  startTime: '08:00:00',
  endTime: '18:00:00',
  isAvailable: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const makeException = (overrides = {}) => ({
  id: 'exc-id',
  date: '2026-07-10',
  isAvailable: false,
  reason: 'Independence Day',
  status: 'active' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  ...overrides,
});

const mockRepo = (): jest.Mocked<AvailabilityRepository> => ({
  findAllRules: jest.fn(),
  findRuleByDay: jest.fn(),
  upsertRule: jest.fn(),
  findExceptions: jest.fn(),
  findAllExceptionsForExport: jest.fn(),
  findExceptionById: jest.fn(),
  findDeletedExceptionById: jest.fn(),
  findExceptionByDate: jest.fn(),
  findExceptionsInRange: jest.fn(),
  createException: jest.fn(),
  updateException: jest.fn(),
  softDeleteException: jest.fn(),
  restoreException: jest.fn(),
  findAppointmentTimesOnDate: jest.fn(),
} as unknown as jest.Mocked<AvailabilityRepository>);

const mockExportSvc = (): jest.Mocked<Pick<ExportService, 'generate'>> => ({
  generate: jest.fn().mockResolvedValue(Buffer.from('export-data')),
});

const mockCache = (): jest.Mocked<Pick<CacheService, 'delByPattern'>> => ({
  delByPattern: jest.fn(),
});

const mockLogger = (): jest.Mocked<Pick<LoggerService, 'info' | 'setContext'>> => ({
  info: jest.fn(),
  setContext: jest.fn(),
});

const mockCls = (): jest.Mocked<Pick<ClsService, 'get'>> => ({
  get: jest.fn().mockReturnValue('trace-id'),
});

const mockAudit = (): jest.Mocked<Pick<IAuditPort, 'log'>> => ({
  log: jest.fn().mockResolvedValue(undefined),
});

const mockTx = (): jest.Mocked<Pick<ITransactionManager, 'runInTx'>> => ({
  runInTx: jest.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()),
});

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let repo: jest.Mocked<AvailabilityRepository>;
  let cache: jest.Mocked<Pick<CacheService, 'delByPattern'>>;
  let audit: jest.Mocked<Pick<IAuditPort, 'log'>>;
  let tx: jest.Mocked<Pick<ITransactionManager, 'runInTx'>>;
  let logger: jest.Mocked<Pick<LoggerService, 'info' | 'setContext'>>;
  let exportSvc: jest.Mocked<Pick<ExportService, 'generate'>>;

  beforeEach(() => {
    repo = mockRepo();
    cache = mockCache();
    audit = mockAudit();
    tx = mockTx();
    logger = mockLogger();
    exportSvc = mockExportSvc();

    service = new AvailabilityService(
      repo as unknown as AvailabilityRepository,
      cache as unknown as CacheService,
      logger as unknown as LoggerService,
      mockCls() as unknown as ClsService,
      audit as unknown as IAuditPort,
      tx as unknown as ITransactionManager,
      exportSvc as unknown as ExportService,
    );
  });

  // ──────────────────────────────
  //  getRules
  // ──────────────────────────────

  describe('getRules', () => {
    it('returns all rules from repository', async () => {
      const rules = [makeRule(), makeRule({ dayOfWeek: 2 })];
      repo.findAllRules.mockResolvedValue(rules);

      const result = await service.getRules();

      expect(result).toEqual(rules);
      expect(repo.findAllRules).toHaveBeenCalledTimes(1);
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────
  //  upsertRule
  // ──────────────────────────────

  describe('upsertRule', () => {
    const dto = { startTime: '08:00:00', endTime: '17:00:00', isAvailable: true };

    it('upserts rule, logs audit and invalidates cache', async () => {
      const rule = makeRule();
      repo.upsertRule.mockResolvedValue(rule);

      const result = await service.upsertRule('user-id', 1, dto);

      expect(result).toEqual(rule);
      expect(repo.upsertRule).toHaveBeenCalledWith(1, dto);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'availability_rules.upserted' }),
        { strict: true },
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/availability*');
      expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/public/availability*');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('upsertRule start'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('upsertRule end'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
    });

    it('throws BadRequestException for invalid dayOfWeek', async () => {
      await expect(service.upsertRule('user-id', 7, dto)).rejects.toThrow(BadRequestException);
      expect(audit.log).not.toHaveBeenCalled();
      expect(cache.delByPattern).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────
  //  createException
  // ──────────────────────────────

  describe('createException', () => {
    const dto = { date: '2026-07-04', isAvailable: false, reason: 'Independence Day' };

    it('creates exception, audits and invalidates cache', async () => {
      repo.findExceptionByDate.mockResolvedValue(null);
      const exc = makeException();
      repo.createException.mockResolvedValue(exc);

      const result = await service.createException('user-id', dto);

      expect(result).toEqual(exc);
      expect(repo.createException).toHaveBeenCalledWith(dto);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'availability_exceptions.created' }),
        { strict: true },
      );
      expect(cache.delByPattern).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('createException start'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('createException end'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
    });

    it('throws ConflictException when exception for date already exists', async () => {
      repo.findExceptionByDate.mockResolvedValue(makeException());

      await expect(service.createException('user-id', dto)).rejects.toThrow(ConflictException);
      expect(repo.createException).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
      expect(cache.delByPattern).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────
  //  updateException
  // ──────────────────────────────

  describe('updateException', () => {
    const dto = { isAvailable: true, reason: 'Moved to next day' };

    it('updates exception, audits and invalidates cache', async () => {
      const existing = makeException();
      const updated = makeException({ isAvailable: true, reason: 'Moved to next day' });
      repo.findExceptionById.mockResolvedValue(existing);
      repo.updateException.mockResolvedValue(updated);

      const result = await service.updateException('user-id', 'exc-id', dto);

      expect(result).toEqual(updated);
      expect(repo.updateException).toHaveBeenCalledWith('exc-id', dto);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'availability_exceptions.updated', resourceId: 'exc-id' }),
        { strict: true },
      );
      expect(cache.delByPattern).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('updateException start'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('updateException end'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
    });

    it('throws NotFoundException when exception does not exist', async () => {
      repo.findExceptionById.mockResolvedValue(null);

      await expect(service.updateException('user-id', 'missing-id', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.updateException).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
      expect(cache.delByPattern).not.toHaveBeenCalled();
    });

    it('throws ConflictException when new date already exists on a different exception', async () => {
      const existing = makeException({ id: 'exc-id', date: '2026-07-10' });
      const conflict = makeException({ id: 'other-id', date: '2026-07-11' });
      repo.findExceptionById.mockResolvedValue(existing);
      repo.findExceptionByDate.mockResolvedValue(conflict);

      await expect(
        service.updateException('user-id', 'exc-id', { date: '2026-07-11' }),
      ).rejects.toThrow(ConflictException);
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────
  //  deleteException
  // ──────────────────────────────

  describe('deleteException', () => {
    it('soft-deletes exception, audits and invalidates cache', async () => {
      repo.findExceptionById.mockResolvedValue(makeException());
      repo.softDeleteException.mockResolvedValue(undefined);

      await service.deleteException('user-id', 'exc-id');

      expect(repo.softDeleteException).toHaveBeenCalledWith('exc-id');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'availability_exceptions.deleted' }),
        { strict: true },
      );
      expect(cache.delByPattern).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('deleteException start'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('deleteException end'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
    });

    it('throws NotFoundException when exception does not exist', async () => {
      repo.findExceptionById.mockResolvedValue(null);

      await expect(service.deleteException('user-id', 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(audit.log).not.toHaveBeenCalled();
      expect(cache.delByPattern).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────
  //  restoreException
  // ──────────────────────────────

  describe('restoreException', () => {
    it('restores exception, audits and invalidates cache', async () => {
      const deleted = makeException({ deletedAt: '2026-07-01T00:00:00.000Z', status: 'suspended' });
      const restored = makeException({ deletedAt: null, status: 'active' });
      repo.findDeletedExceptionById.mockResolvedValue(deleted);
      repo.restoreException.mockResolvedValue(restored);

      const result = await service.restoreException('user-id', 'exc-id');

      expect(result).toEqual(restored);
      expect(repo.restoreException).toHaveBeenCalledWith('exc-id');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'availability_exceptions.restored', resourceId: 'exc-id' }),
        { strict: true },
      );
      expect(cache.delByPattern).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('restoreException start'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('restoreException end'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
    });

    it('throws NotFoundException when deleted exception does not exist', async () => {
      repo.findDeletedExceptionById.mockResolvedValue(null);

      await expect(service.restoreException('user-id', 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.restoreException).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
      expect(cache.delByPattern).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────
  //  exportExceptions
  // ──────────────────────────────

  describe('exportExceptions', () => {
    it('fetches rows, generates CSV file and audits with strict:false', async () => {
      const rows = [makeException(), makeException({ id: 'exc-2', date: '2026-08-01' })];
      repo.findAllExceptionsForExport.mockResolvedValue(rows);

      const result = await service.exportExceptions('user-id', { format: 'csv' });

      expect(repo.findAllExceptionsForExport).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        undefined,
      );
      expect(exportSvc.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          sheetName: 'Availability Exceptions',
          rows: expect.arrayContaining([expect.any(Object)]),
        }),
        'csv',
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'availability_exceptions.export',
          actorId: 'user-id',
          metadata: expect.objectContaining({ format: 'csv', rowCount: 2 }),
        }),
        { strict: false },
      );
      expect(result.contentType).toBe('text/csv; charset=utf-8');
      expect(result.filename).toMatch(/^availability-exceptions-.*\.csv$/);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('exportExceptions start'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('exportExceptions end'),
        expect.objectContaining({ traceId: 'trace-id' }),
      );
    });

    it('returns xlsx content-type for xlsx format', async () => {
      repo.findAllExceptionsForExport.mockResolvedValue([]);

      const result = await service.exportExceptions('user-id', { format: 'xlsx' });

      expect(exportSvc.generate).toHaveBeenCalledWith(expect.anything(), 'xlsx');
      expect(result.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(result.filename).toMatch(/^availability-exceptions-.*\.xlsx$/);
    });

    it('does NOT invalidate cache', async () => {
      repo.findAllExceptionsForExport.mockResolvedValue([]);

      await service.exportExceptions('user-id', { format: 'csv' });

      expect(cache.delByPattern).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────
  //  getTimeSlots
  // ──────────────────────────────

  describe('getTimeSlots', () => {
    it('returns empty array when date has blocking exception', async () => {
      repo.findExceptionByDate.mockResolvedValue(makeException({ isAvailable: false }));

      const result = await service.getTimeSlots({ date: '2026-07-04', serviceDuration: 60 });

      expect(result).toEqual([]);
      expect(repo.findRuleByDay).not.toHaveBeenCalled();
    });

    it('returns empty array when weekly rule is closed', async () => {
      repo.findExceptionByDate.mockResolvedValue(null);
      repo.findRuleByDay.mockResolvedValue(makeRule({ isAvailable: false }));

      const result = await service.getTimeSlots({ date: '2026-07-06', serviceDuration: 60 });

      expect(result).toEqual([]);
    });

    it('returns slots when rule is available and no conflicts', async () => {
      repo.findExceptionByDate.mockResolvedValue(null);
      repo.findRuleByDay.mockResolvedValue(makeRule({
        startTime: '08:00:00',
        endTime: '10:00:00',
        isAvailable: true,
      }));
      repo.findAppointmentTimesOnDate.mockResolvedValue([]);

      const result = await service.getTimeSlots({ date: '2026-07-07', serviceDuration: 60 });

      // 08:00+60=09:00<=10:00, 08:30+60=09:30<=10:00, 09:00+60=10:00<=10:00
      expect(result.length).toBe(3);
      expect(result[0]?.formattedTime).toBe('08:00');
      expect(result[1]?.formattedTime).toBe('08:30');
      expect(result[2]?.formattedTime).toBe('09:00');
    });

    it('excludes slots within buffer zone of existing appointment', async () => {
      repo.findExceptionByDate.mockResolvedValue(null);
      repo.findRuleByDay.mockResolvedValue(makeRule({
        startTime: '08:00:00',
        endTime: '18:00:00',
        isAvailable: true,
      }));
      // Appointment at 13:00 (780 min) → 7-hour buffer: 06:00 (360 min) – 20:00 (1200 min)
      // All slots 8 AM–6 PM fall within buffer → entire day blocked
      const inspectionTime = new Date('2026-07-07T13:00:00.000Z');
      repo.findAppointmentTimesOnDate.mockResolvedValue([{ inspectionTime }]);

      const result = await service.getTimeSlots({ date: '2026-07-07', serviceDuration: 60 });

      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────
  //  getCalendarAvailability
  // ──────────────────────────────

  describe('getCalendarAvailability', () => {
    it('returns unavailable for days where rule is closed', async () => {
      repo.findAllRules.mockResolvedValue([]);
      repo.findExceptionsInRange.mockResolvedValue([]);

      const result = await service.getCalendarAvailability({ year: 2027, month: 1 });

      result.forEach((d) => expect(d.available).toBe(false));
    });

    it('marks exception date as unavailable with reason', async () => {
      repo.findAllRules.mockResolvedValue([makeRule({ dayOfWeek: 4, isAvailable: true })]);
      repo.findExceptionsInRange.mockResolvedValue([
        makeException({ date: '2027-01-01', isAvailable: false, reason: "New Year's Day" }),
      ]);

      const result = await service.getCalendarAvailability({ year: 2027, month: 1 });

      const jan1 = result.find((d) => d.date === '2027-01-01');
      expect(jan1?.available).toBe(false);
      expect(jan1?.reason).toBe("New Year's Day");
    });
  });
});
