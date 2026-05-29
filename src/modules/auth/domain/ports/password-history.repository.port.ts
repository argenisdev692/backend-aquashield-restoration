import { PasswordHistoryEntry } from '../entities/password-history.entity';

export interface IPasswordHistoryRepository {
  /**
   * Append the new hash and prune older entries beyond
   * PASSWORD_HISTORY_LIMIT in the same transaction. Adapter is responsible
   * for the prune step (window function or `id NOT IN (top-N)`).
   */
  append(entry: PasswordHistoryEntry, limit: number): Promise<void>;

  /**
   * The last N bcrypt hashes for the user, newest first. The use-case
   * compares the candidate password against each with `bcrypt.compare` to
   * enforce no-reuse.
   */
  findRecentHashes(userId: string, limit: number): Promise<string[]>;
}

export const PASSWORD_HISTORY_REPOSITORY = Symbol('IPasswordHistoryRepository');
