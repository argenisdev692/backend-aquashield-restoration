import { ContactSupport } from '../entities/contact-support.aggregate';
import {
  ContactSupportReadModel,
  PaginatedContactSupport,
} from '../read-models/contact-support.read-model';
import type { TrashedMode } from '../../../../shared/crud/trashed.util';
import type { DateRange } from '../../../../shared/crud/date-range.util';

export interface ListContactSupportFilters {
  page: number;
  limit: number;
  /** When defined, filters by the `isRead` flag. */
  isRead?: boolean;
  /** Soft-delete visibility — Laravel-style. Defaults to `exclude`. */
  trashed?: TrashedMode;
  /** Inclusive date range on `createdAt`. */
  range?: DateRange;
}

export interface ExportContactSupportFilters {
  /** When defined, filters by the `isRead` flag. */
  isRead?: boolean;
  /** Soft-delete visibility — Laravel-style. Defaults to `exclude`. */
  trashed?: TrashedMode;
  /** Inclusive date range on `createdAt`. */
  range?: DateRange;
}

export interface IContactSupportRepository {
  /** Aggregate load for write paths — excludes soft-deleted rows. */
  findById(id: string): Promise<ContactSupport | null>;
  /** Aggregate load including soft-deleted rows — used by restore. */
  findByIdWithDeleted(id: string): Promise<ContactSupport | null>;
  save(entity: ContactSupport): Promise<void>;
  /**
   * Read model for a single row.
   * @param withTrashed when `true`, soft-deleted requests are returned too
   *                    (Laravel `withTrashed()->find()`).
   */
  findReadModelById(
    id: string,
    withTrashed?: boolean,
  ): Promise<ContactSupportReadModel | null>;
  /** Paginated read models, with optional soft-delete visibility. */
  findMany(
    filters: ListContactSupportFilters,
  ): Promise<PaginatedContactSupport>;
  /**
   * All rows matching the filters — never paginated. Hard-capped at
   * `EXPORT_MAX_ROWS` to prevent runaway memory use (OWASP API #4).
   */
  findAllForExport(
    filters: ExportContactSupportFilters,
  ): Promise<ContactSupportReadModel[]>;
  /** Set-based soft delete — single SQL statement, idempotent. */
  bulkDelete(ids: string[]): Promise<{ count: number }>;
  /** Set-based restore — single SQL statement, idempotent. */
  bulkRestore(ids: string[]): Promise<{ count: number }>;
}

export const CONTACT_SUPPORT_REPOSITORY = Symbol('IContactSupportRepository');
