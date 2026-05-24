/**
 * Emitted AFTER the repository row transitions to COMPLETED and the
 * surrounding tx commits. The retention listener subscribes to prune
 * the oldest backups beyond the configured keep-N window.
 */
export class BackupCompletedEvent {
  constructor(
    public readonly backupId: string,
    public readonly objectKey: string,
    public readonly sizeBytes: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

/**
 * Emitted AFTER the repository row transitions to FAILED. Listeners can
 * fan out alerting (pager, Slack) without coupling the write handler to
 * the notification stack.
 */
export class BackupFailedEvent {
  constructor(
    public readonly backupId: string,
    public readonly error: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
