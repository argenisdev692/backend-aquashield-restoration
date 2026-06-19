import { RetellCallDomainException } from '../exceptions/retell-call-domain.exception';

/**
 * Retell's own call identifier (e.g. `Jabr9TXYYJHfvl6Syypi88rdAHYHmcq6`).
 * Opaque string — we only guarantee it is present and non-blank so the
 * webhook upsert has a stable natural key to deduplicate on.
 */
export class RetellCallId {
  private constructor(private readonly value: string) {}

  static create(raw: unknown): RetellCallId {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new RetellCallDomainException('Retell call_id is missing or blank');
    }
    return new RetellCallId(raw.trim());
  }

  toString(): string {
    return this.value;
  }
}
