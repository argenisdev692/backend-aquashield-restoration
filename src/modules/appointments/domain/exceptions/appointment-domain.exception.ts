import { DomainException } from '../../../../shared/exceptions/domain.exception';

/**
 * Appointment bounded-context invariant violation (e.g. an illegal lead-status
 * transition). Inherits the HTTP 422 mapping from {@link DomainException}.
 */
export class AppointmentDomainException extends DomainException {}
