import { z } from 'zod';
import { InvalidBackupIdException } from '../exceptions/backup-domain.exception';

const UuidSchema = z.string().uuid();

export class BackupId {
  private constructor(public readonly value: string) {}

  static create(value: string): BackupId {
    const parsed = UuidSchema.safeParse(value);
    if (!parsed.success) {
      throw new InvalidBackupIdException(value);
    }
    return new BackupId(parsed.data);
  }

  static reconstitute(value: string): BackupId {
    return new BackupId(value);
  }

  equals(other: BackupId): boolean {
    return this.value === other.value;
  }
}
