export class DeleteBackupCommand {
  constructor(
    public readonly backupId: string,
    public readonly actorId: string,
  ) {}
}
