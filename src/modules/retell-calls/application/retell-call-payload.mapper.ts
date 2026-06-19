import type { RetellCallObject } from './dtos/retell-webhook.dto';
import type { RetellCallUpsertInput } from '../domain/repositories/retell-call-repository.interface';

/** Epoch-ms → Date, tolerant of missing / zero values. */
function msToDate(ms: number | undefined): Date | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms);
}

/**
 * Normalize a Retell `call` object (from a webhook or the list/get API) into
 * the flat persistence shape. The full original object is preserved in `raw`.
 */
export function normalizeRetellCall(
  call: RetellCallObject,
): RetellCallUpsertInput {
  return {
    callId: call.call_id,
    agentId: call.agent_id ?? null,
    callType: call.call_type ?? null,
    direction: call.direction ?? null,
    fromNumber: call.from_number ?? null,
    toNumber: call.to_number ?? null,
    callStatus: call.call_status ?? null,
    disconnectionReason: call.disconnection_reason ?? null,
    startedAt: msToDate(call.start_timestamp),
    endedAt: msToDate(call.end_timestamp),
    durationMs: typeof call.duration_ms === 'number' ? call.duration_ms : null,
    userSentiment: call.call_analysis?.user_sentiment ?? null,
    callSummary: call.call_analysis?.call_summary ?? null,
    transcript: call.transcript ?? null,
    recordingUrl: call.recording_url ?? null,
    raw: call,
  };
}
