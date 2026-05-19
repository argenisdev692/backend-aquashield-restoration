import { Module } from '@nestjs/common';
import { StorageModule } from '../../shared/storage/storage.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { BlogCategoryController } from './blog-category.controller';
import { BlogCategoryService } from './blog-category.service';
import { BlogCategoryRepository } from './blog-category.repository';

@Module({
  imports: [StorageModule, CacheModule],
  controllers: [BlogCategoryController],
  providers: [BlogCategoryService, BlogCategoryRepository],
  exports: [BlogCategoryService],
})
export class BlogCategoryModule {}
