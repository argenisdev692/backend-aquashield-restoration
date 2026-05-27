export class BackupDomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidBackupIdException extends BackupDomainException {
  constructor(value: string) {
    super(`Invalid backup id: ${value}`);
  }
}

export class BackupAlreadyTerminalException extends BackupDomainException {
  constructor(id: string, currentStatus: string) {
    super(
      `Backup ${id} is already in terminal state ${currentStatus}; cannot transition again`,
    );
  }
}

export class BackupNotFoundException extends BackupDomainException {
  constructor(id: string) {
    super(`Backup ${id} not found`);
  }
}

export class BackupNotDownloadableException extends BackupDomainException {
  constructor(id: string, status: string) {
    super(
      `Backup ${id} is in status ${status} and has no downloadable artifact`,
    );
  }
}
