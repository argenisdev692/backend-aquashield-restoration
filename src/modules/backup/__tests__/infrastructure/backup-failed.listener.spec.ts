import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { BackupFailedEvent } from '../../domain/events/backup-completed.domain-event';
import { BackupFailedListener } from '../../infrastructure/event-listeners/backup-failed.listener';

describe('BackupFailedListener', () => {
  let logger: LoggerService;
  let cls: ClsService;
  let listener: BackupFailedListener;

  beforeEach(() => {
    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as LoggerService;
    cls = {
      get: jest.fn().mockReturnValue('trace-fail'),
      isActive: jest.fn().mockReturnValue(true),
    } as unknown as ClsService;
    listener = new BackupFailedListener(logger, cls);
  });

  it('logs at ERROR with traceId, backupId, error, occurredAt', () => {
    const occurredAt = new Date('2026-05-24T12:34:56Z');
    listener.handle(
      new BackupFailedEvent('backup-1', 'pg_dump exited 1', occurredAt),
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Backup failed',
      expect.objectContaining({
        traceId: 'trace-fail',
        backupId: 'backup-1',
        error: 'pg_dump exited 1',
        occurredAt: occurredAt.toISOString(),
      }),
    );
  });

  it('omits traceId when CLS is not active (out-of-request listener)', () => {
    (cls.isActive as jest.Mock).mockReturnValue(false);

    listener.handle(new BackupFailedEvent('backup-2', 'boom'));

    expect(logger.error).toHaveBeenCalledWith(
      'Backup failed',
      expect.objectContaining({ traceId: undefined, backupId: 'backup-2' }),
    );
  });
});
