import { Backup } from '../../domain/entities/backup.aggregate';
import { BackupId } from '../../domain/value-objects/backup-id.vo';
import {
  BackupStatus,
  BackupTrigger,
} from '../../domain/value-objects/backup-status.vo';
import { BackupAlreadyTerminalException } from '../../domain/exceptions/backup-domain.exception';

const NEW_ID = '01950000-0000-7000-8000-000000000001';

function newPending(): Backup {
  return Backup.createPending({
    id: BackupId.reconstitute(NEW_ID),
    triggeredBy: BackupTrigger.Manual,
    actorId: '01950000-0000-7000-8000-000000000999',
  });
}

describe('Backup aggregate', () => {
  it('createPending initialises PENDING with start/created timestamps', () => {
    const backup = newPending();
    expect(backup.status).toBe(BackupStatus.Pending);
    expect(backup.triggeredBy).toBe(BackupTrigger.Manual);
    expect(backup.objectKey).toBeNull();
    expect(backup.sizeBytes).toBeNull();
    expect(backup.completedAt).toBeNull();
    expect(backup.isDownloadable()).toBe(false);
  });

  it('markCompleted records artifact metadata and flips status', () => {
    const backup = newPending();
    backup.markCompleted({
      objectKey: 'backups/2026/05/24/abc.dump',
      sizeBytes: 12_345,
      checksum: 'deadbeef',
    });
    expect(backup.status).toBe(BackupStatus.Completed);
    expect(backup.objectKey).toBe('backups/2026/05/24/abc.dump');
    expect(backup.sizeBytes).toBe(12_345);
    expect(backup.checksum).toBe('deadbeef');
    expect(backup.completedAt).toBeInstanceOf(Date);
    expect(backup.isDownloadable()).toBe(true);
  });

  it('markFailed records the error and flips status', () => {
    const backup = newPending();
    backup.markFailed({ error: 'pg_dump exited with code=1' });
    expect(backup.status).toBe(BackupStatus.Failed);
    expect(backup.error).toBe('pg_dump exited with code=1');
    expect(backup.completedAt).toBeInstanceOf(Date);
    expect(backup.isDownloadable()).toBe(false);
  });

  it('markFailed truncates absurdly long error messages', () => {
    const backup = newPending();
    backup.markFailed({ error: 'x'.repeat(10_000) });
    expect(backup.error?.length).toBe(2_000);
  });

  it('cannot transition twice — second mark throws', () => {
    const backup = newPending();
    backup.markCompleted({
      objectKey: 'k',
      sizeBytes: 1,
      checksum: 'c',
    });
    expect(() =>
      backup.markFailed({ error: 'too late' }),
    ).toThrow(BackupAlreadyTerminalException);
  });

  it('isDownloadable requires both COMPLETED status and non-null objectKey', () => {
    const backup = newPending();
    expect(backup.isDownloadable()).toBe(false);
    backup.markFailed({ error: 'boom' });
    expect(backup.isDownloadable()).toBe(false);
  });
});
