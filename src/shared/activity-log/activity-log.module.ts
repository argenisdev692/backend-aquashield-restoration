import { Global, Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogQueryService } from './activity-log-query.service';
import { AUDIT_PORT } from './audit.port';

/**
 * Global audit module — binds {@link AUDIT_PORT} to the activity-log writer
 * so any module can `@Inject(AUDIT_PORT)` without re-providing it.
 */
@Global()
@Module({
  providers: [
    ActivityLogService,
    ActivityLogQueryService,
    { provide: AUDIT_PORT, useExisting: ActivityLogService },
  ],
  exports: [AUDIT_PORT, ActivityLogQueryService],
})
export class ActivityLogModule {}
