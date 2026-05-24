import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { RunBackupCommand } from '../../application/commands/run-backup.command';
import { BackupTrigger } from '../../domain/value-objects/backup-status.vo';

const JOB_NAME = 'database-backup-daily';

/**
 * Daily database backup at 00:00 UTC.
 *
 * `waitForCompletion: true` prevents a second invocation from starting
 * while a previous one (which can take minutes) is still running — a
 * second pg_dump in parallel would compete for IO and pollute the row
 * count for retention.
 *
 * Errors are caught and logged here so a single failed run does NOT
 * crash the scheduler process; the row is marked FAILED inside the
 * handler and visible in the admin list.
 */
@Injectable()
export class BackupScheduler {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(BackupScheduler.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: JOB_NAME,
    waitForCompletion: true,
    timeZone: 'UTC',
  })
  async runDailyBackup(): Promise<void> {
    // Synthesise a traceId for this tick so downstream handlers/adapters
    // can correlate every log line of the run with the cron invocation.
    const traceId = `cron-${JOB_NAME}-${randomUUID()}`;
    await this.cls.run(async () => {
      this.cls.set('traceId', traceId);
      this.logger.info('BackupScheduler.runDailyBackup tick', {
        traceId,
        job: JOB_NAME,
      });
      try {
        const id = await this.commandBus.execute<RunBackupCommand, string>(
          new RunBackupCommand(BackupTrigger.Scheduler, null),
        );
        this.logger.info('BackupScheduler.runDailyBackup completed', {
          traceId,
          job: JOB_NAME,
          backupId: id,
        });
      } catch (err) {
        this.logger.error('BackupScheduler.runDailyBackup failed', {
          traceId,
          job: JOB_NAME,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }
}
