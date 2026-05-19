import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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
  ) {
    this.logger.setContext(BlogCategoryService.name);
  }

  async findAll(): Promise<BlogCategory[]> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.findAll', { traceId });
    return this.repository.findAll();
  }

  async findById(id: string): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.findById', { traceId, id });
    return this.findOrFail(id);
  }

  async create(
    userId: string,
    dto: CreateBlogCategoryDto,
  ): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.create start', { traceId, userId });

    const result = await this.repository.create({ ...dto, userId });

    await this.audit.log({
      action: 'blogcategory.created',
      actorId: userId,
      resourceType: 'BLOG_CATEGORY',
      resourceId: result.id,
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
    await this.findOrFail(id);
    const result = await this.repository.update(id, dto);

    await this.audit.log({
      action: 'blogcategory.updated',
      resourceType: 'BLOG_CATEGORY',
      resourceId: id,
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.update end', { traceId, id });
    return result;
  }

  async delete(id: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.delete start', { traceId, id });
    await this.findOrFail(id);
    // Soft delete only: the R2 image is intentionally kept so restore() can
    // bring the record back with its image intact. (Unlike companydata, which
    // hard-deletes and therefore removes the file.)
    await this.repository.softDelete(id);

    await this.audit.log({
      action: 'blogcategory.deleted',
      resourceType: 'BLOG_CATEGORY',
      resourceId: id,
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
    if (existing.image) {
      await this.deleteImageFile(existing.image);
    }

    const ext = file.mimeType.split('/').at(1) ?? 'bin';
    const key = `${this.imageDirectory}/${uuidv7()}.${ext}`;
    await this.storage.upload(key, file.buffer, file.mimeType);

    const result = await this.repository.update(id, {
      image: this.storage.publicUrl(key),
    });

    await this.audit.log({
      action: 'blogcategory.image_uploaded',
      resourceType: 'BLOG_CATEGORY',
      resourceId: id,
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.uploadImage end', { traceId, id });
    return result;
  }

  async deleteImage(id: string): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.deleteImage start', { traceId, id });

    const existing = await this.findOrFail(id);
    if (existing.image) {
      await this.deleteImageFile(existing.image);
    }

    const result = await this.repository.update(id, { image: null });

    await this.audit.log({
      action: 'blogcategory.image_deleted',
      resourceType: 'BLOG_CATEGORY',
      resourceId: id,
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.deleteImage end', { traceId, id });
    return result;
  }

  async restore(id: string): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.restore start', { traceId, id });
    await this.findOrFailWithDeleted(id);
    const result = await this.repository.restore(id);

    await this.audit.log({
      action: 'blogcategory.restored',
      resourceType: 'BLOG_CATEGORY',
      resourceId: id,
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.restore end', { traceId, id });
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
}
