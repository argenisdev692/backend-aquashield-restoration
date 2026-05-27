import { BackupId } from '../value-objects/backup-id.vo';
import { BackupStatus, BackupTrigger } from '../value-objects/backup-status.vo';
import { BackupAlreadyTerminalException } from '../exceptions/backup-domain.exception';

interface BackupProps {
  id: BackupId;
  status: BackupStatus;
  triggeredBy: BackupTrigger;
  actorId: string | null;
  objectKey: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

const ERROR_MESSAGE_MAX_LENGTH = 2000;

/**
 * Backup aggregate — owns the state machine for a single backup attempt.
 *
 * Lifecycle: PENDING → COMPLETED | FAILED (terminal, immutable thereafter).
 *
 * The aggregate is intentionally thin because the work that produces the
 * artifact (pg_dump + R2 upload) lives in adapters; the aggregate only
 * enforces "you cannot transition twice".
 */
export class Backup {
  private constructor(private props: BackupProps) {}

  static createPending(params: {
    id: BackupId;
    triggeredBy: BackupTrigger;
    actorId: string | null;
    now?: Date;
  }): Backup {
    const now = params.now ?? new Date();
    return new Backup({
      id: params.id,
      status: BackupStatus.Pending,
      triggeredBy: params.triggeredBy,
      actorId: params.actorId,
      objectKey: null,
      sizeBytes: null,
      checksum: null,
      error: null,
      startedAt: now,
      completedAt: null,
      createdAt: now,
    });
  }

  /** Hydrate from persistence — never validates invariants. */
  static reconstitute(props: BackupProps): Backup {
    return new Backup({ ...props });
  }

  markCompleted(params: {
    objectKey: string;
    sizeBytes: number;
    checksum: string;
    now?: Date;
  }): void {
    this.assertPending();
    this.props.status = BackupStatus.Completed;
    this.props.objectKey = params.objectKey;
    this.props.sizeBytes = params.sizeBytes;
    this.props.checksum = params.checksum;
    this.props.completedAt = params.now ?? new Date();
    this.props.error = null;
  }

  markFailed(params: { error: string; now?: Date }): void {
    this.assertPending();
    this.props.status = BackupStatus.Failed;
    this.props.error = params.error.slice(0, ERROR_MESSAGE_MAX_LENGTH);
    this.props.completedAt = params.now ?? new Date();
  }

  private assertPending(): void {
    if (this.props.status !== BackupStatus.Pending) {
      throw new BackupAlreadyTerminalException(
        this.props.id.value,
        this.props.status,
      );
    }
  }

  get id(): BackupId {
    return this.props.id;
  }
  get status(): BackupStatus {
    return this.props.status;
  }
  get triggeredBy(): BackupTrigger {
    return this.props.triggeredBy;
  }
  get actorId(): string | null {
    return this.props.actorId;
  }
  get objectKey(): string | null {
    return this.props.objectKey;
  }
  get sizeBytes(): number | null {
    return this.props.sizeBytes;
  }
  get checksum(): string | null {
    return this.props.checksum;
  }
  get error(): string | null {
    return this.props.error;
  }
  get startedAt(): Date {
    return this.props.startedAt;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  isDownloadable(): boolean {
    return (
      this.props.status === BackupStatus.Completed &&
      this.props.objectKey !== null
    );
  }
}
