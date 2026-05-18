/**
 * Domain shape of a blog category.
 * Plain TypeScript — no NestJS, no Prisma, no decorators.
 * Dates are serialized to ISO strings by the repository (lean mobile-first payloads).
 * Nullable fields are `T | null`, never `T | undefined`.
 */
export interface BlogCategory {
  id: string;
  name: string | null;
  description: string | null;
  image: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
