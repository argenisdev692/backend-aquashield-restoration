import type { TrashedMode } from '../../../../shared/crud/trashed.util';
import type { DateRange } from '../../../../shared/crud/date-range.util';

/**
 * Normalized snapshot extracted from a Retell webhook / API `call` object,
 * ready to be persisted. `raw` keeps the full original payload (JSONB).
 */
export interface RetellCallUpsertInput {
  callId: string;
  agentId: string | null;
  callType: string | null;
  direction: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  callStatus: string | null;
  disconnectionReason: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMs: number | null;
  userSentiment: string | null;
  callSummary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  raw: unknown;
}

/** Read projection returned to the application / presentation layers. */
export interface RetellCallReadModel {
  id: string;
  callId: string;
  agentId: string | null;
  callType: string | null;
  direction: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  callStatus: string | null;
  disconnectionReason: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMs: number | null;
  userSentiment: string | null;
  callSummary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UpsertCallResult {
  record: RetellCallReadModel;
  /** `true` only when the row was inserted (not a webhook re-delivery). */
  created: boolean;
}

export interface RetellCallListFilters {
  page: number;
  limit: number;
  search?: string;
  callStatus?: string;
  userSentiment?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Persistence boundary for Retell call records. The Prisma implementation is
 * the ONLY place allowed to import `PrismaService`.
 */
export interface IRetellCallRepository {
  /** Insert by `callId`, or update the live row if it already exists. */
  upsertByCallId(input: RetellCallUpsertInput): Promise<UpsertCallResult>;

  findById(
    id: string,
    withTrashed?: boolean,
  ): Promise<RetellCallReadModel | null>;

  paginate(
    filters: RetellCallListFilters,
    mode: TrashedMode,
    range: DateRange,
  ): Promise<PaginatedResult<RetellCallReadModel>>;

  findForExport(
    filters: Omit<RetellCallListFilters, 'page' | 'limit'>,
    mode: TrashedMode,
    range: DateRange,
  ): Promise<RetellCallReadModel[]>;

  /** Returns `false` when no live row matched the id. */
  markRead(id: string): Promise<boolean>;
  softDelete(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;

  /** Bulk soft-delete / restore — one `updateMany`, returns affected count. */
  bulkSoftDelete(ids: readonly string[]): Promise<number>;
  bulkRestore(ids: readonly string[]): Promise<number>;
}

export const RETELL_CALL_REPOSITORY = Symbol('IRetellCallRepository');
