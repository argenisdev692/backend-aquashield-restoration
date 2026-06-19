/**
 * Emitted AFTER a brand-new Retell call is persisted from the
 * `call_analyzed` webhook (never on webhook re-deliveries / backfill syncs).
 * Drives the "new call" admin email + realtime broadcast.
 */
export class RetellCallRecordedEvent {
  static readonly eventName = 'retell-call.recorded';

  constructor(
    /** Local `retell_calls.id` (UUID). */
    public readonly recordId: string,
    /** Retell's own `call_id`. */
    public readonly callId: string,
  ) {}
}
