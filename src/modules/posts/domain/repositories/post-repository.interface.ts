import { Post } from '../entities/post.aggregate';
import type { TrashedMode } from '../../../../shared/crud/trashed.util';

export interface PostReadModel {
  id: string;
  postTitle: string;
  postTitleSlug: string;
  postContent: string;
  postExcerpt: string | null;
  postCoverImage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  categoryId: string | null;
  userId: string | null;
  postStatus: 'draft' | 'published' | 'scheduled';
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  categoryName?: string | null;
  userName?: string | null;
}

export interface PostFilters {
  categoryId?: string;
  userId?: string;
  postStatus?: 'draft' | 'published' | 'scheduled';
  search?: string;
  page?: number;
  limit?: number;
  /** Soft-delete visibility — Laravel-style. Defaults to `exclude`. */
  trashed?: TrashedMode;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IPostRepository {
  findById(id: string, trashed?: boolean): Promise<Post | null>;
  findReadModelById(
    id: string,
    trashed?: boolean,
  ): Promise<PostReadModel | null>;
  findIdBySlug(slug: string): Promise<string | null>;
  findAll(filters: PostFilters): Promise<PaginatedResult<PostReadModel>>;
  findScheduledDue(): Promise<Post[]>;
  save(post: Post): Promise<void>;
  delete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  bulkDelete(ids: string[]): Promise<{ count: number }>;
  bulkRestore(ids: string[]): Promise<{ count: number }>;
}

export const POST_REPOSITORY = Symbol('IPostRepository');
