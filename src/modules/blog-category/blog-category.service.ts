import { Injectable, NotFoundException } from '@nestjs/common';
import { BlogCategoryRepository } from './blog-category.repository';
import type { BlogCategory } from './blog-category.entity';
import type { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import type { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';
import { LoggerService } from '../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class BlogCategoryService {
  constructor(
    private readonly repository: BlogCategoryRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
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

  async create(userId: string, dto: CreateBlogCategoryDto): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.create', { traceId, userId });
    return this.repository.create({ ...dto, userId });
  }

  async update(id: string, dto: UpdateBlogCategoryDto): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.update', { traceId, id });
    await this.findOrFail(id);
    return this.repository.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.delete', { traceId, id });
    await this.findOrFail(id);
    await this.repository.softDelete(id);
  }

  async restore(id: string): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.restore', { traceId, id });
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundException('Blog category not found');
    return this.repository.restore(id);
  }

  private async findOrFail(id: string): Promise<BlogCategory> {
    const result = await this.repository.findById(id);
    if (!result) throw new NotFoundException('Blog category not found');
    return result;
  }
}
