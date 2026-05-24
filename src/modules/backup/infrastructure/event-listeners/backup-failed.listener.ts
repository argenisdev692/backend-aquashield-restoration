import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../../logger/logger.service';
import { BackupFailedEvent } from '../../domain/events/backup-completed.domain-event';

/**
 * Reacts to a failed backup run.
 *
 * Currently only logs at ERROR level — the row already carries the
 * truncated error message and `RunBackupHandler` logs the same line.
 * The reason this listener exists is to keep `RunBackupHandler` free
 * of notification concerns: when oncall asks for Slack / pager / email
 * alerts on backup failures, the integration lands here, NOT in the
 * write handler.
 *
 * Idempotency: alerting must be safe to fire twice (EventEmitter2 is
 * in-process today, but if we move to a transactional outbox tomorrow
 * at-least-once is the contract).
 */
@Injectable()
export class BackupFailedListener {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(BackupFailedListener.name);
  }

  @OnEvent('backup.failed')
  handle(event: BackupFailedEvent): void {
    this.logger.error('Backup failed', {
      backupId: event.backupId,
      error: event.error,
      occurredAt: event.occurredAt.toISOString(),
    });
    // TODO: wire Slack/Resend notification to super-admins once the
    //       INotificationPort contract is defined for ops alerts.
  }
}
