import { PasswordHistoryEntry } from '../../../domain/entities/password-history.entity';

export interface PasswordHistoryRow {
  id: string;
  userId: string;
  passwordHash: string;
  createdAt: Date;
}

export function toPasswordHistoryEntry(
  row: PasswordHistoryRow,
): PasswordHistoryEntry {
  return PasswordHistoryEntry.reconstitute({
    id: row.id,
    userId: row.userId,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  });
}
