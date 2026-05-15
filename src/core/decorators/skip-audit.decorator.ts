import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT_KEY = 'skip_audit';

/**
 * Disables the automatic `AuditInterceptor` for a mutation route
 * (e.g. when the use case logs a more specific business action itself).
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);
