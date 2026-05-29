/**
 * Append-only password history row. Pruning to the last
 * PASSWORD_HISTORY_LIMIT entries happens in the repository layer (one
 * `DELETE … WHERE rn > N` per write).
 */
export const PASSWORD_HISTORY_LIMIT = 5;

export class PasswordHistoryEntry {
  private constructor(
    public readonly id: string | null,
    public readonly userId: string,
    public readonly passwordHash: string,
    public readonly createdAt: Date,
  ) {}

  static create(props: {
    userId: string;
    passwordHash: string;
    createdAt?: Date;
  }): PasswordHistoryEntry {
    if (!props.userId) {
      throw new Error('PasswordHistoryEntry.userId is required');
    }
    if (!props.passwordHash) {
      throw new Error('PasswordHistoryEntry.passwordHash is required');
    }
    return new PasswordHistoryEntry(
      null,
      props.userId,
      props.passwordHash,
      props.createdAt ?? new Date(),
    );
  }

  static reconstitute(props: {
    id: string;
    userId: string;
    passwordHash: string;
    createdAt: Date;
  }): PasswordHistoryEntry {
    return new PasswordHistoryEntry(
      props.id,
      props.userId,
      props.passwordHash,
      props.createdAt,
    );
  }
}
