import { Post } from '../../../domain/entities/post.aggregate';
import { PostId } from '../../../domain/value-objects/post-id.vo';
import { $Enums, Prisma } from '../../../../../generated/prisma/client';
import type { Post as PostRow } from '../../../../../generated/prisma/client';
import { PostReadModel } from '../../../domain/repositories/post-repository.interface';

export class PostMapper {
  static toDomain(row: PostRow): Post {
    return new Post(
      PostId.reconstitute(row.id),
      row.postTitle,
      row.postTitleSlug,
      row.postContent,
      row.postExcerpt,
      row.postCoverImage,
      row.metaTitle,
      row.metaDescription,
      row.metaKeywords,
      row.categoryId,
      row.userId,
      row.postStatus as 'draft' | 'published' | 'scheduled',
      row.scheduledAt,
    );
  }

  static toPersistence(
    entity: Post,
  ): Prisma.PostUncheckedCreateInput {
    const plain = entity.toPlain();
    return {
      id: plain.id,
      postTitle: plain.postTitle,
      postTitleSlug: plain.postTitleSlug,
      postContent: plain.postContent,
      postExcerpt: plain.postExcerpt,
      postCoverImage: plain.postCoverImage,
      metaTitle: plain.metaTitle,
      metaDescription: plain.metaDescription,
      metaKeywords: plain.metaKeywords,
      categoryId: plain.categoryId,
      userId: plain.userId,
      postStatus: $Enums.PostStatus[
        plain.postStatus as keyof typeof $Enums.PostStatus
      ] ?? $Enums.PostStatus.draft,
      scheduledAt: plain.scheduledAt,
    };
  }

  static toReadModel(
    row: PostRow & {
      category?: { name: string | null } | null;
      user?: { name: string | null } | null;
    },
  ): PostReadModel {
    return {
      id: row.id,
      postTitle: row.postTitle,
      postTitleSlug: row.postTitleSlug,
      postContent: row.postContent,
      postExcerpt: row.postExcerpt,
      postCoverImage: row.postCoverImage,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      metaKeywords: row.metaKeywords,
      categoryId: row.categoryId,
      userId: row.userId,
      postStatus: row.postStatus as 'draft' | 'published' | 'scheduled',
      scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      categoryName: row.category?.name ?? null,
      userName: row.user?.name ?? null,
    };
  }
}
