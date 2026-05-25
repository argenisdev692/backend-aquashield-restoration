import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../database/prisma.service';
import { LoggerService } from '../../../../logger/logger.service';

const JOB_NAME = 'activity-log-retention';

/**
 * Daily retention job — permanently deletes ActivityLog rows older than 4 months.
 *
 * - Runs at 00:00 UTC every day.
 * - Uses waitForCompletion to avoid overlapping executions.
 * - Synthesizes its own traceId inside cls.run() so every log line from the tick
 *   is correlated (same pattern as BackupScheduler).
 * - Intentionally does NOT call IAuditPort: this is maintenance on the audit
 *   table itself. Auditing "we deleted old audit rows" adds no value and risks
 *   circularity / bloat.
 * - Errors are caught and logged; the scheduler process must never crash.
 */
@Injectable()
export class ActivityLogRetentionScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ActivityLogRetentionScheduler.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: JOB_NAME,
    waitForCompletion: true,
    timeZone: 'UTC',
  })
  async purgeOldActivityLogs(): Promise<void> {
    const traceId = `cron-${JOB_NAME}-${randomUUID()}`;

    await this.cls.run(async () => {
      this.cls.set('traceId', traceId);

      this.logger.info('ActivityLogRetentionScheduler start', {
        traceId,
        job: JOB_NAME,
      });

      try {
        // Keep the last 4 months of audit history (inclusive of today).
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 4);

        const result = await this.prisma.activityLog.deleteMany({
          where: {
            createdAt: {
              lt: cutoff,
            },
          },
        });

        this.logger.info('ActivityLogRetentionScheduler completed', {
          traceId,
          job: JOB_NAME,
          deletedCount: result.count,
          cutoffDate: cutoff.toISOString(),
        });
      } catch (err) {
        this.logger.error('ActivityLogRetentionScheduler failed', {
          traceId,
          job: JOB_NAME,
          error: err instanceof Error ? err.message : String(err),
        });
        // Swallow — do not let a retention failure take down the scheduler host.
      }
    });
  }
}
