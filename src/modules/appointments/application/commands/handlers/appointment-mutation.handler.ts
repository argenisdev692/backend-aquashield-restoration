import { NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { IAppointmentRepository } from '../../../domain/repositories/appointment-repository.interface';
import type { IAuditPort } from '../../../domain/ports/outbound/audit.port.interface';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../../logger/logger.service';
import { Appointment } from '../../../domain/entities/appointment.aggregate';

/**
 * Cache key pattern mirroring the `CacheTtlInterceptor` scheme
 * `http:{userId}:{originalUrl}` — every mutation wildcard-invalidates the
 * whole `/appointments` namespace. Single source of truth for all handlers.
 */
export const APPOINTMENTS_CACHE_PATTERN = 'http:*:/appointments*';

/** ISO-string → `Date`, preserving `null`/absent as SQL NULL. */
export function toNullableDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

/**
 * Shared scaffold for the appointment Command Handlers — centralises the
 * repository/audit/cache/logger/cls wiring, the `findOrFail` guard
 * (PATTERNS #1) and the list-cache invalidation so each concrete handler
 * keeps only its `execute()` orchestration and `@Transactional() persist()`.
 *
 * `EventEmitter2` is intentionally NOT injected here — handlers that emit
 * domain events (create/update/delete/mark-read/bulk) inject it themselves,
 * while `restore` (no event) stays free of the dependency.
 */
export abstract class AppointmentMutationHandler {
  constructor(
    protected readonly repo: IAppointmentRepository,
    protected readonly audit: IAuditPort,
    protected readonly cache: ICachePort,
    protected readonly logger: LoggerService,
    protected readonly cls: ClsService,
  ) {
    this.logger.setContext(new.target.name);
  }

  protected get traceId(): string | undefined {
    return this.cls.get<string>('traceId');
  }

  /** Loads the aggregate or throws a 404 — the one true existence check. */
  protected async findOrFail(
    id: string,
    trashed = false,
  ): Promise<Appointment> {
    const appointment = trashed
      ? await this.repo.findById(id, true)
      : await this.repo.findById(id);
    if (!appointment) {
      throw new NotFoundException(`Appointment with id ${id} not found`);
    }
    return appointment;
  }

  /** Wildcard-invalidates the `/appointments` HTTP cache after a commit. */
  protected invalidateListCache(): Promise<void> {
    return this.cache.delByPattern(APPOINTMENTS_CACHE_PATTERN);
  }
}
