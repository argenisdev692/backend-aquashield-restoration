import { DomainException } from '../../../../shared/exceptions/domain.exception';

/**
 * Contact-support domain-invariant violation.
 *
 * Extends the shared {@link DomainException} so the `GlobalExceptionFilter`
 * maps it to HTTP 422 (Unprocessable Content) instead of a generic 500.
 */
export class ContactSupportDomainException extends DomainException {}
