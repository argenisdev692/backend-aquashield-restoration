import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { BlogCategoryRepository } from './blog-category.repository';
import type { BlogCategory } from './blog-category.entity';
import type { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import type { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';
import { StorageService } from '../../shared/storage/storage.service';
import { CacheService } from '../../shared/cache/cache.service';
import { LoggerService } from '../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../shared/activity-log/audit.port';
import {
  TRANSACTION_MANAGER,
  type ITransactionManager,
} from '../../shared/database/transaction-manager.port';
import type { TrashedMode } from '../../shared/crud/trashed.util';

@Injectable()
export class BlogCategoryService {
  private readonly imageDirectory = 'blog-category-images';
  /** Matches the CacheTtlInterceptor key scheme `http:{userId}:{originalUrl}`. */
  private readonly cacheKeyPattern = 'http:*:/blog-categories*';

  constructor(
    private readonly repository: BlogCategoryRepository,
    private readonly storage: StorageService,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER) private readonly tx: ITransactionManager,
  ) {
    this.logger.setContext(BlogCategoryService.name);
  }

  async findAll(
    limit = 50,
    skip = 0,
    trashed: TrashedMode = 'exclude',
  ): Promise<BlogCategory[]> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.findAll', {
      traceId,
      limit,
      skip,
      trashed,
    });
    return this.repository.findAll(limit, skip, trashed);
  }

  async findById(id: string, withTrashed: boolean = false): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.findById', {
      traceId,
      id,
      withTrashed,
    });
    const result = await this.repository.findById(id, withTrashed);
    if (!result) throw new NotFoundException('Blog category not found');
    return result;
  }

  async create(
    userId: string,
    dto: CreateBlogCategoryDto,
  ): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.create start', { traceId, userId });

    // Check for duplicate category name
    if (dto.name) {
      const existing = await this.repository.findByName(userId, dto.name);
      if (existing) {
        throw new ConflictException(
          'Category with this name already exists',
        );
      }
    }

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.create({ ...dto, userId });
      await this.audit.log(
        {
          action: 'blogcategory.created',
          actorId: userId,
          resourceType: 'BLOG_CATEGORY',
          resourceId: row.id,
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.create end', {
      traceId,
      blogCategoryId: result.id,
    });
    return result;
  }

  async update(id: string, dto: UpdateBlogCategoryDto): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.update start', { traceId, id });
    const existing = await this.findOrFail(id);

    // Check for duplicate category name if name is being changed
    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.repository.findByName(
        existing.userId,
        dto.name,
      );
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          'Category with this name already exists',
        );
      }
    }

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.update(id, dto);
      await this.audit.log(
        {
          action: 'blogcategory.updated',
          resourceType: 'BLOG_CATEGORY',
          resourceId: id,
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.update end', { traceId, id });
    return result;
  }

  async delete(id: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.delete start', { traceId, id });
    await this.findOrFail(id);

    await this.tx.runInTx(async () => {
      // Soft delete only: the R2 image is intentionally kept so restore() can
      // bring the record back with its image intact. (Unlike companydata, which
      // hard-deletes and therefore removes the file.)
      await this.repository.softDelete(id);
      await this.audit.log(
        {
          action: 'blogcategory.deleted',
          resourceType: 'BLOG_CATEGORY',
          resourceId: id,
        },
        { strict: true },
      );
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.delete end', { traceId, id });
  }

  async uploadImage(
    id: string,
    file: { buffer: Buffer; mimeType: string },
  ): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.uploadImage start', { traceId, id });

    const existing = await this.findOrFail(id);

    const ext = file.mimeType.split('/').at(1) ?? 'bin';
    const key = `${this.imageDirectory}/${uuidv7()}.${ext}`;
    await this.storage.upload(key, file.buffer, file.mimeType);

    let result: BlogCategory;
    try {
      result = await this.tx.runInTx(async () => {
        const row = await this.repository.update(id, {
          image: this.storage.publicUrl(key),
        });
        await this.audit.log(
          {
            action: 'blogcategory.image_uploaded',
            resourceType: 'BLOG_CATEGORY',
            resourceId: id,
          },
          { strict: true },
        );
        return row;
      });
    } catch (error) {
      await this.deleteImageFileByKey(key);
      throw error;
    }

    if (existing.image) {
      await this.deleteImageFile(existing.image);
    }

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.uploadImage end', { traceId, id });
    return result;
  }

  async deleteImage(id: string): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.deleteImage start', { traceId, id });

    const existing = await this.findOrFail(id);

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.update(id, { image: null });
      await this.audit.log(
        {
          action: 'blogcategory.image_deleted',
          resourceType: 'BLOG_CATEGORY',
          resourceId: id,
        },
        { strict: true },
      );
      return row;
    });

    if (existing.image) {
      await this.deleteImageFile(existing.image);
    }

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.deleteImage end', { traceId, id });
    return result;
  }

  async restore(id: string): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.restore start', { traceId, id });
    await this.findOrFailWithDeleted(id);

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.restore(id);
      await this.audit.log(
        {
          action: 'blogcategory.restored',
          resourceType: 'BLOG_CATEGORY',
          resourceId: id,
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.restore end', { traceId, id });
    return result;
  }

  async bulkDelete(ids: string[], actorId: string): Promise<{ count: number }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.bulkDelete start', {
      traceId,
      actorId,
      idsCount: ids.length,
    });

    const result = await this.tx.runInTx(async () => {
      const { count } = await this.repository.bulkDelete(ids);
      await this.audit.log(
        {
          action: 'blogcategory.bulk_deleted',
          actorId,
          resourceType: 'BLOG_CATEGORY',
          resourceId: ids.length === 1 ? ids[0] : undefined,
          metadata: { ids, count },
        },
        { strict: true },
      );
      return { count };
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.bulkDelete end', {
      traceId,
      count: result.count,
    });
    return result;
  }

  async bulkRestore(
    ids: string[],
    actorId: string,
  ): Promise<{ count: number }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.bulkRestore start', {
      traceId,
      actorId,
      idsCount: ids.length,
    });

    const result = await this.tx.runInTx(async () => {
      const { count } = await this.repository.bulkRestore(ids);
      await this.audit.log(
        {
          action: 'blogcategory.bulk_restored',
          actorId,
          resourceType: 'BLOG_CATEGORY',
          resourceId: ids.length === 1 ? ids[0] : undefined,
          metadata: { ids, count },
        },
        { strict: true },
      );
      return { count };
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.bulkRestore end', {
      traceId,
      count: result.count,
    });
    return result;
  }

  private async findOrFail(id: string): Promise<BlogCategory> {
    const result = await this.repository.findById(id);
    if (!result) throw new NotFoundException('Blog category not found');
    return result;
  }

  /** Existence check that also sees soft-deleted rows — used by restore. */
  private async findOrFailWithDeleted(id: string): Promise<BlogCategory> {
    const result = await this.repository.findByIdWithDeleted(id);
    if (!result) throw new NotFoundException('Blog category not found');
    return result;
  }

  /** Drops every cached blog-category GET response after a mutation. */
  private async invalidateCache(): Promise<void> {
    await this.cache.delByPattern(this.cacheKeyPattern);
  }

  /** Best-effort R2 cleanup — logs but never rethrows (PATTERN #4). */
  private async deleteImageFile(imageUrl: string): Promise<void> {
    try {
      const key = this.storage.keyFromUrl(imageUrl);
      await this.storage.delete(key);
    } catch (error) {
      const traceId = this.cls.get<string>('traceId');
      this.logger.error('Failed to delete blog category image from storage', {
        traceId,
        error,
      });
    }
  }

  /** Rollback helper for the R2 blob when the surrounding DB tx aborts. */
  private async deleteImageFileByKey(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      const traceId = this.cls.get<string>('traceId');
      this.logger.error('Failed to rollback uploaded blog category image', {
        traceId,
        key,
        error,
      });
    }
  }
}
