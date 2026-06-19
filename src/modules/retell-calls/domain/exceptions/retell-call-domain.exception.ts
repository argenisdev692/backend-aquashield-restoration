/**
 * Raised when a Retell call payload violates a domain rule (missing call_id,
 * unknown record, etc.). Mapped to the appropriate HTTP status at the edge.
 */
export class RetellCallDomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetellCallDomainException';
  }
}

/** Raised when a call record cannot be found for the given id. */
export class RetellCallNotFoundException extends RetellCallDomainException {
  constructor(id: string) {
    super(`Retell call ${id} not found`);
    this.name = 'RetellCallNotFoundException';
  }
}
