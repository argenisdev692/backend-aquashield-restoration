import type { RetellCallObject } from '../../../application/dtos/retell-webhook.dto';

export interface RetellListCallsFilter {
  startTimestampMs?: number;
  endTimestampMs?: number;
  limit?: number;
}

/**
 * Outbound port to the Retell REST API. Used for backfill/sync only — the
 * real-time path is the webhook. Returns the same loosely-typed `call`
 * objects the webhook delivers so the normalizer is shared.
 */
export interface IRetellApiPort {
  listCalls(filter?: RetellListCallsFilter): Promise<RetellCallObject[]>;
  getCall(callId: string): Promise<RetellCallObject | null>;
}

export const RETELL_API_PORT = Symbol('IRetellApiPort');
