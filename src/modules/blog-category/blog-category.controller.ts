import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from 'nestjs-zod';
import { CacheTTL } from '@nestjs/cache-manager';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../core/guards/casl.guard';
import { CheckAbilities } from '../../core/decorators/check-abilities.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Action } from '../../core/access/actions.enum';
import type { AuthenticatedUser } from '../../core/access/actions.enum';
import { SkipCache } from '../../core/decorators/skip-cache.decorator';
import { TTL_SECONDS } from '../../shared/cache/cache-ttl.constants';
import { resolveTrashedMode } from '../../shared/crud/trashed.util';
import { BlogCategoryService } from './blog-category.service';
import { CreateBlogCategorySchema } from './dto/create-blog-category.dto';
import type { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { UpdateBlogCategorySchema } from './dto/update-blog-category.dto';
import type { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';
import { BlogCategoryResponse } from './dto/blog-category.response';
import { BulkIdsSchema } from './dto/bulk-ids.dto';
import type { BulkIdsDto } from './dto/bulk-ids.dto';
import {
  ListBlogCategoryQuerySchema,
  GetBlogCategoryQuerySchema,
  ExportBlogCategoryQuerySchema,
} from './dto/list-blog-category.dto';
import type {
  ListBlogCategoryQueryDto,
  GetBlogCategoryQueryDto,
  ExportBlogCategoryQueryDto,
} from './dto/list-blog-category.dto';

@ApiTags('blog-categories')
@ApiBearerAuth()
@Controller('blog-categories')
@UseGuards(JwtAuthGuard, CaslGuard)
export class BlogCategoryController {
  constructor(private readonly service: BlogCategoryService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiCreatedResponse({ type: BlogCategoryResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @CheckAbilities({ action: Action.Create, subject: 'BLOG_CATEGORY' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateBlogCategorySchema))
    dto: CreateBlogCategoryDto,
  ): Promise<BlogCategoryResponse> {
    return this.service.create(user.id, dto);
  }

  @Get('trash')
  @SkipThrottle()
  @ApiOkResponse({ type: [BlogCategoryResponse] })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @SkipCache()
  @CheckAbilities({ action: Action.Restore, subject: 'BLOG_CATEGORY' })
  async findTrash(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListBlogCategoryQuerySchema))
    query: ListBlogCategoryQueryDto,
  ): Promise<BlogCategoryResponse[]> {
    return this.service.findAll(user.id, query.limit, query.skip, 'only');
  }

  @Get()
  @SkipThrottle()
  @ApiOkResponse({ type: [BlogCategoryResponse] })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted categories (Laravel `withTrashed()`).',
  })
  @ApiQuery({
    name: 'onlyTrashed',
    required: false,
    type: Boolean,
    description:
      'Return ONLY soft-deleted categories. Cannot be combined with `withTrashed`. Requires Action.Restore (use GET /blog-categories/trash).',
  })
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @CheckAbilities({ action: Action.Read, subject: 'BLOG_CATEGORY' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListBlogCategoryQuerySchema))
    query: ListBlogCategoryQueryDto,
  ): Promise<BlogCategoryResponse[]> {
    if (query.onlyTrashed) {
      throw new BadRequestException(
        'Use GET /blog-categories/trash to list soft-deleted categories.',
      );
    }
    const trashed = resolveTrashedMode({ withTrashed: query.withTrashed });
    return this.service.findAll(user.id, query.limit, query.skip, trashed);
  }

  @Get('export')
  @SkipThrottle()
  @SkipCache()
  @ApiOkResponse({
    description: 'Binary export of blog categories (CSV, XLSX, or PDF).',
    content: { 'application/octet-stream': {} },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiQuery({ name: 'format', required: true, enum: ['csv', 'xlsx', 'pdf'] })
  @ApiQuery({ name: 'withTrashed', required: false, type: Boolean })
  @ApiQuery({ name: 'onlyTrashed', required: false, type: Boolean })
  @CheckAbilities({ action: Action.Read, subject: 'BLOG_CATEGORY' })
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ExportBlogCategoryQuerySchema))
    query: ExportBlogCategoryQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename, contentType } =
      await this.service.exportBlogCategories(
        user.id,
        { withTrashed: query.withTrashed, onlyTrashed: query.onlyTrashed },
        query.format,
      );

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(buffer);
  }

  @Get(':id')
  @SkipThrottle()
  @ApiOkResponse({ type: BlogCategoryResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description:
      'When `true`, return the category even if it has been soft-deleted.',
  })
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @CheckAbilities({ action: Action.Read, subject: 'BLOG_CATEGORY' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(GetBlogCategoryQuerySchema))
    query: GetBlogCategoryQueryDto,
  ): Promise<BlogCategoryResponse> {
    return this.service.findById(user.id, id, query.withTrashed === true);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOkResponse({ type: BlogCategoryResponse })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CheckAbilities({ action: Action.Update, subject: 'BLOG_CATEGORY' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateBlogCategorySchema))
    dto: UpdateBlogCategoryDto,
  ): Promise<BlogCategoryResponse> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  @CheckAbilities({ action: Action.Delete, subject: 'BLOG_CATEGORY' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.delete(user.id, id);
  }

  @Post(':id/restore')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOkResponse({ type: BlogCategoryResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @SkipCache()
  @CheckAbilities({ action: Action.Restore, subject: 'BLOG_CATEGORY' })
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BlogCategoryResponse> {
    return this.service.restore(user.id, id);
  }

  @Post('bulk-delete')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(200)
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @SkipCache()
  @CheckAbilities({ action: Action.Delete, subject: 'BLOG_CATEGORY' })
  async bulkDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
  ): Promise<{ count: number }> {
    return this.service.bulkDelete(user.id, dto.ids);
  }

  @Post('bulk-restore')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(200)
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @SkipCache()
  @CheckAbilities({ action: Action.Restore, subject: 'BLOG_CATEGORY' })
  async bulkRestore(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
  ): Promise<{ count: number }> {
    return this.service.bulkRestore(user.id, dto.ids);
  }

  @Post(':id/image')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOkResponse({ type: BlogCategoryResponse })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Invalid file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file: Express.Multer.File, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/webp'];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  @CheckAbilities({ action: Action.Update, subject: 'BLOG_CATEGORY' })
  async uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BlogCategoryResponse> {
    if (!file) {
      throw new BadRequestException(
        'No file provided or invalid file type. Allowed: png, jpeg, webp (max 2 MB)',
      );
    }
    return this.service.uploadImage(user.id, id, {
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
  }

  @Delete(':id/image')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOkResponse({ type: BlogCategoryResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CheckAbilities({ action: Action.Update, subject: 'BLOG_CATEGORY' })
  async deleteImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BlogCategoryResponse> {
    return this.service.deleteImage(user.id, id);
  }
}
