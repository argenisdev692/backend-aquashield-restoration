export interface IPasswordHistoryRepository {
  addEntry(userId: string, hashedPassword: string): Promise<void>;
  getRecent(userId: string, limit: number): Promise<string[]>;
  pruneOldest(userId: string, keepCount: number): Promise<void>;
}

export const PASSWORD_HISTORY_REPOSITORY = Symbol('IPasswordHistoryRepository');
