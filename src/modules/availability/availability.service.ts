import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { ClsService } from 'nestjs-cls';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../shared/activity-log/audit.port';
import {
  TRANSACTION_MANAGER,
  type ITransactionManager,
} from '../../shared/database/transaction-manager.port';
import { CacheService } from '../../shared/cache/cache.service';
import { LoggerService } from '../../logger/logger.service';
import { ExportService } from '../../shared/export/export.service';
import { resolveTrashedMode } from '../../shared/crud/trashed.util';
import { resolveDateRange } from '../../shared/crud/date-range.util';
import {
  AvailabilityRepository,
  type AvailabilityRuleEntity,
  type AvailabilityExceptionEntity,
  type AppointmentTimeEntry,
} from './availability.repository';
import type { UpsertRuleDto } from './dto/upsert-rule.dto';
import type { CreateExceptionDto } from './dto/create-exception.dto';
import type { UpdateExceptionDto } from './dto/update-exception.dto';
import type { ExceptionFilterDto, ExceptionExportQueryDto } from './dto/exception-filter.dto';
import type { TimeSlotsQueryDto } from './dto/time-slots-query.dto';
import type { CalendarQueryDto } from './dto/calendar-query.dto';

dayjs.extend(utc);
dayjs.extend(timezone);

const HOUSTON_TZ = 'America/Chicago';
const SLOT_STEP_MINUTES = 30;
// 7-hour exclusion zone around each booked inspection.
// Symmetric: an appointment at 11 AM blocks 4 AM–6 PM, effectively
// making the full business day (8 AM–6 PM) unavailable. An appointment
// at 8 AM blocks 1 AM–3 PM, leaving afternoon slots open.
const BUFFER_MINUTES = 420;

export interface TimeSlot {
  time: string;
  formattedTime: string;
}

export interface DayAvailability {
  date: string;
  available: boolean;
  reason?: string;
}

type AppointmentBuffer = { bufferStart: number; bufferEnd: number };

@Injectable()
export class AvailabilityService {
  // Covers both /availability/* (admin) and /public/availability/* (public) caches.
  private readonly cacheKeyPatterns = [
    'http:*:/availability*',
    'http:*:/public/availability*',
  ] as const;

  constructor(
    private readonly repository: AvailabilityRepository,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER) private readonly tx: ITransactionManager,
    private readonly exportService: ExportService,
  ) {
    this.logger.setContext(AvailabilityService.name);
  }

  // ──────────────────────────────
  //  Rules
  // ──────────────────────────────

  async getRules(): Promise<AvailabilityRuleEntity[]> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AvailabilityService.getRules', { traceId });
    return this.repository.findAllRules();
  }

  async upsertRule(
    userId: string,
    dayOfWeek: number,
    dto: UpsertRuleDto,
  ): Promise<AvailabilityRuleEntity> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AvailabilityService.upsertRule start', { traceId, userId, dayOfWeek });

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new BadRequestException(`Day of week must be between 0 (Sun) and 6 (Sat)`);
    }

    const result = await this.tx.runInTx(async () => {
      const rule = await this.repository.upsertRule(dayOfWeek, {
        startTime: dto.startTime,
        endTime: dto.endTime,
        isAvailable: dto.isAvailable,
      });
      await this.audit.log(
        {
          action: 'availability_rules.upserted',
          actorId: userId,
          resourceType: 'AVAILABILITY_RULE',
          resourceId: rule.id,
        },
        { strict: true },
      );
      return rule;
    });

    await this.invalidateCache();
    this.logger.info('AvailabilityService.upsertRule end', { traceId, dayOfWeek });
    return result;
  }

  // ──────────────────────────────
  //  Exceptions
  // ──────────────────────────────

  async listExceptions(
    filters: ExceptionFilterDto,
  ): Promise<{ data: AvailabilityExceptionEntity[]; total: number }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AvailabilityService.listExceptions', { traceId });
    const trashed = resolveTrashedMode(filters);
    const range = resolveDateRange({ start_date: filters.start_date, end_date: filters.end_date });
    return this.repository.findExceptions({ page: filters.page, limit: filters.limit, range, isAvailable: filters.isAvailable, trashed });
  }

  /** Trash-bin view: always returns only soft-deleted exceptions. */
  async listDeletedExceptions(
    filters: ExceptionFilterDto,
  ): Promise<{ data: AvailabilityExceptionEntity[]; total: number }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AvailabilityService.listDeletedExceptions', { traceId });
    const range = resolveDateRange({ start_date: filters.start_date, end_date: filters.end_date });
    return this.repository.findExceptions({ page: filters.page, limit: filters.limit, range, isAvailable: filters.isAvailable, trashed: 'only' });
  }

  async createException(
    userId: string,
    dto: CreateExceptionDto,
  ): Promise<AvailabilityExceptionEntity> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AvailabilityService.createException start', { traceId, userId, date: dto.date });

    const existing = await this.repository.findExceptionByDate(dto.date);
    if (existing) throw new ConflictException(`An exception for ${dto.date} already exists`);

    const result = await this.tx.runInTx(async () => {
      const exc = await this.repository.createException(dto);
      await this.audit.log(
        {
          action: 'availability_exceptions.created',
          actorId: userId,
          resourceType: 'AVAILABILITY_EXCEPTION',
          resourceId: exc.id,
        },
        { strict: true },
      );
      return exc;
    });

    await this.invalidateCache();
    this.logger.info('AvailabilityService.createException end', { traceId, id: result.id });
    return result;
  }

  async updateException(
    userId: string,
    id: string,
    dto: UpdateExceptionDto,
  ): Promise<AvailabilityExceptionEntity> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AvailabilityService.updateException start', { traceId, userId, id });

    const existing = await this.findExceptionOrFail(id);

    if (dto.date && dto.date !== existing.date) {
      const conflict = await this.repository.findExceptionByDate(dto.date);
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`An exception for ${dto.date} already exists`);
      }
    }

    const result = await this.tx.runInTx(async () => {
      const exc = await this.repository.updateException(id, dto);
      await this.audit.log(
        {
          action: 'availability_exceptions.updated',
          actorId: userId,
          resourceType: 'AVAILABILITY_EXCEPTION',
          resourceId: id,
        },
        { strict: true },
      );
      return exc;
    });

    await this.invalidateCache();
    this.logger.info('AvailabilityService.updateException end', { traceId, id });
    return result;
  }

  async deleteException(userId: string, id: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AvailabilityService.deleteException start', { traceId, userId, id });

    await this.findExceptionOrFail(id);

    await this.tx.runInTx(async () => {
      await this.repository.softDeleteException(id);
      await this.audit.log(
        {
          action: 'availability_exceptions.deleted',
          actorId: userId,
          resourceType: 'AVAILABILITY_EXCEPTION',
          resourceId: id,
        },
        { strict: true },
      );
    });

    await this.invalidateCache();
    this.logger.info('AvailabilityService.deleteException end', { traceId, id });
  }

  async restoreException(
    userId: string,
    id: string,
  ): Promise<AvailabilityExceptionEntity> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AvailabilityService.restoreException start', { traceId, userId, id });

    await this.findDeletedExceptionOrFail(id);

    const result = await this.tx.runInTx(async () => {
      const exc = await this.repository.restoreException(id);
      await this.audit.log(
        {
          action: 'availability_exceptions.restored',
          actorId: userId,
          resourceType: 'AVAILABILITY_EXCEPTION',
          resourceId: id,
        },
        { strict: true },
      );
      return exc;
    });

    await this.invalidateCache();
    this.logger.info('AvailabilityService.restoreException end', { traceId, id });
    return result;
  }

  async exportExceptions(
    userId: string,
    filters: ExceptionExportQueryDto,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AvailabilityService.exportExceptions start', {
      traceId,
      userId,
      format: filters.format,
    });

    const trashed = resolveTrashedMode(filters);
    const range = resolveDateRange({ start_date: filters.start_date, end_date: filters.end_date });
    const rows = await this.repository.findAllExceptionsForExport(trashed, range, filters.isAvailable);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const buffer = await this.exportService.generate<Record<string, unknown>>(
      {
        columns: [
          { header: 'ID', key: 'id', width: 38 },
          { header: 'Date', key: 'date', width: 12 },
          { header: 'Available', key: 'isAvailable', width: 12, format: (v) => (v ? 'Yes' : 'No') },
          { header: 'Reason', key: 'reason', width: 40 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Created At', key: 'createdAt', width: 24 },
          { header: 'Deleted At', key: 'deletedAt', width: 24 },
        ],
        rows: rows as unknown as Array<Record<string, unknown>>,
        sheetName: 'Availability Exceptions',
      },
      filters.format,
    );

    const contentType =
      filters.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8';

    await this.audit.log(
      {
        action: 'availability_exceptions.export',
        actorId: userId,
        resourceType: 'AVAILABILITY_EXCEPTION',
        metadata: { format: filters.format, rowCount: rows.length },
      },
      { strict: false },
    );

    this.logger.info('AvailabilityService.exportExceptions end', {
      traceId,
      format: filters.format,
      rowCount: rows.length,
    });

    return {
      buffer,
      filename: `availability-exceptions-${timestamp}.${filters.format}`,
      contentType,
    };
  }

  // ──────────────────────────────
  //  Public: time slots
  // ──────────────────────────────

  async getTimeSlots(query: TimeSlotsQueryDto): Promise<TimeSlot[]> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AvailabilityService.getTimeSlots', { traceId, query });

    const requestedDate = dayjs.tz(query.date, HOUSTON_TZ).startOf('day');
    if (!requestedDate.isValid()) return [];

    const dateStr = requestedDate.format('YYYY-MM-DD');
    const dayOfWeek = requestedDate.day();

    const exception = await this.repository.findExceptionByDate(dateStr);
    if (exception && !exception.isAvailable) {
      this.logger.info('AvailabilityService.getTimeSlots: date blocked by exception', { traceId, date: dateStr, reason: exception.reason });
      return [];
    }

    const rule = await this.repository.findRuleByDay(dayOfWeek);
    if (!rule || !rule.isAvailable) return [];

    const appointments = await this.repository.findAppointmentTimesOnDate(dateStr);
    const buffers = this.buildAppointmentBuffers(appointments);
    return this.generateSlots(rule, query.serviceDuration, buffers, requestedDate);
  }

  // ──────────────────────────────
  //  Public: calendar month view
  // ──────────────────────────────

  async getCalendarAvailability(query: CalendarQueryDto): Promise<DayAvailability[]> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AvailabilityService.getCalendarAvailability', { traceId, query });

    const now = dayjs().tz(HOUSTON_TZ).startOf('day');
    const monthStart = dayjs.tz(`${query.year}-${String(query.month).padStart(2, '0')}-01`, HOUSTON_TZ).startOf('month');
    const monthEnd = monthStart.endOf('month');

    const [rules, exceptions] = await Promise.all([
      this.repository.findAllRules(),
      this.repository.findExceptionsInRange(monthStart.toDate(), monthEnd.toDate()),
    ]);

    const ruleByDay = new Map(rules.map((r) => [r.dayOfWeek, r]));
    const exceptionByDate = new Map(exceptions.map((e) => [e.date, e]));

    const result: DayAvailability[] = [];
    for (let day = 1; day <= monthEnd.date(); day++) {
      const dateStr = `${query.year}-${String(query.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayjsDate = dayjs.tz(dateStr, HOUSTON_TZ);
      result.push(this.resolveDayAvailability({
        dateStr,
        dayjsDate,
        now,
        exception: exceptionByDate.get(dateStr),
        rule: ruleByDay.get(dayjsDate.day()),
      }));
    }

    return result;
  }

  // ──────────────────────────────
  //  Private — slot helpers
  // ──────────────────────────────

  private buildAppointmentBuffers(appointments: AppointmentTimeEntry[]): AppointmentBuffer[] {
    return appointments
      .filter((a) => a.inspectionTime !== null)
      .map((a) => {
        const inspTime = dayjs(a.inspectionTime as Date);
        const apptMinutes = inspTime.hour() * 60 + inspTime.minute();
        return { bufferStart: apptMinutes - BUFFER_MINUTES, bufferEnd: apptMinutes + BUFFER_MINUTES };
      });
  }

  private isSlotBlocked(slotStart: number, slotEnd: number, buffers: AppointmentBuffer[]): boolean {
    return buffers.some(
      (b) =>
        (slotStart >= b.bufferStart && slotStart <= b.bufferEnd) ||
        (slotEnd >= b.bufferStart && slotEnd <= b.bufferEnd) ||
        (slotStart <= b.bufferStart && slotEnd >= b.bufferEnd),
    );
  }

  private generateSlots(
    rule: AvailabilityRuleEntity,
    serviceDuration: number,
    buffers: AppointmentBuffer[],
    baseDate: dayjs.Dayjs,
  ): TimeSlot[] {
    const [ruleStartH, ruleStartM] = rule.startTime.split(':').map(Number);
    const [ruleEndH, ruleEndM] = rule.endTime.split(':').map(Number);
    const ruleStart = (ruleStartH ?? 0) * 60 + (ruleStartM ?? 0);
    const ruleEnd = (ruleEndH ?? 0) * 60 + (ruleEndM ?? 0);

    const slots: TimeSlot[] = [];
    let current = ruleStart;
    while (current + serviceDuration <= ruleEnd) {
      if (!this.isSlotBlocked(current, current + serviceDuration, buffers)) {
        const d = baseDate.hour(Math.floor(current / 60)).minute(current % 60).second(0);
        slots.push({ time: d.toISOString(), formattedTime: d.format('HH:mm') });
      }
      current += SLOT_STEP_MINUTES;
    }
    return slots;
  }

  // ──────────────────────────────
  //  Private — calendar helper
  // ──────────────────────────────

  private resolveDayAvailability(params: {
    dateStr: string;
    dayjsDate: dayjs.Dayjs;
    now: dayjs.Dayjs;
    exception?: AvailabilityExceptionEntity;
    rule?: AvailabilityRuleEntity;
  }): DayAvailability {
    const { dateStr, dayjsDate, now, exception, rule } = params;
    if (dayjsDate.isBefore(now)) return { date: dateStr, available: false, reason: 'past' };
    if (exception) {
      return {
        date: dateStr,
        available: exception.isAvailable,
        ...(exception.reason ? { reason: exception.reason } : {}),
      };
    }
    if (!rule || !rule.isAvailable) return { date: dateStr, available: false, reason: 'closed' };
    return { date: dateStr, available: true };
  }

  // ──────────────────────────────
  //  Private — entity guards
  // ──────────────────────────────

  private async findExceptionOrFail(id: string): Promise<AvailabilityExceptionEntity> {
    const entity = await this.repository.findExceptionById(id);
    if (!entity) throw new NotFoundException(`Availability exception ${id} not found`);
    return entity;
  }

  private async findDeletedExceptionOrFail(id: string): Promise<AvailabilityExceptionEntity> {
    const entity = await this.repository.findDeletedExceptionById(id);
    if (!entity) throw new NotFoundException(`Deleted availability exception ${id} not found`);
    return entity;
  }

  private async invalidateCache(): Promise<void> {
    await Promise.all(this.cacheKeyPatterns.map((p) => this.cache.delByPattern(p)));
  }
}
