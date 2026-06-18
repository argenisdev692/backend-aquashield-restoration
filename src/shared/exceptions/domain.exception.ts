/**
 * Base class for domain-invariant violations (DDD bounded contexts).
 *
 * A domain exception means the request was well-formed (Zod already passed)
 * but breaks a business rule — e.g. an illegal lead-status transition. The
 * `GlobalExceptionFilter` maps every `DomainException` to HTTP 422
 * (Unprocessable Content), distinct from a 400 (malformed) or a 500 (bug).
 *
 * Subclass it per bounded context (`AppointmentDomainException`, …) so the
 * thrown error stays typed and catchable while still inheriting the HTTP
 * mapping for free.
 */
export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    // `new.target` resolves to the concrete subclass, so the RFC 7807 `title`
    // reflects the precise context (e.g. `AppointmentDomainException`).
    this.name = new.target.name;
  }
}
