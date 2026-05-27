import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiQuery,
  ApiProduces,
  ApiOperation,
  ApiBody,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../../../core/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../../../../core/guards/casl.guard';
import { CacheTTL } from '@nestjs/cache-manager';
import { TTL_SECONDS } from '../../../../../shared/cache/cache-ttl.constants';
import { SkipCache } from '../../../../../core/decorators/skip-cache.decorator';
import {
  CreatePostDto,
  CreatePostSchema,
} from '../../../application/dtos/create-post.dto';
import {
  UpdatePostDto,
  UpdatePostSchema,
} from '../../../application/dtos/update-post.dto';
import {
  PostFiltersDto,
  PostFiltersSchema,
} from '../../../application/dtos/post-filters.dto';
import {
  ExportPostsDto,
  ExportPostsSchema,
} from '../../../application/dtos/export-posts.dto';
import { CreatePostCommand } from '../../../application/commands/create-post.command';
import { UpdatePostCommand } from '../../../application/commands/update-post.command';
import { DeletePostCommand } from '../../../application/commands/delete-post.command';
import { RestorePostCommand } from '../../../application/commands/restore-post.command';
import { BulkDeletePostsCommand } from '../../../application/commands/bulk-delete-posts.command';
import { BulkRestorePostsCommand } from '../../../application/commands/bulk-restore-posts.command';
import { GetPostByIdQuery } from '../../../application/queries/get-post-by-id.query';
import { GetPostsListQuery } from '../../../application/queries/get-posts-list.query';
import {
  ExportPostsQuery,
  type ExportPostsResult,
} from '../../../application/queries/export-posts.query';
import {
  BulkIdsDto,
  BulkIdsSchema,
} from '../../../application/dtos/bulk-ids.dto';
import {
  GeneratePostPreviewDto,
  GeneratePostPreviewSchema,
} from '../../../application/dtos/generate-post-preview.dto';
import { GeneratePostPreviewCommand } from '../../../application/commands/generate-post-preview.command';
import { GeneratePostPreviewResponse } from '../presenters/generate-post-preview.response';
import type {
  PostReadModel,
  PaginatedResult,
} from '../../../domain/repositories/post-repository.interface';
import { PostResponse } from '../presenters/post.response';
import { PostListResponse } from '../presenters/post-list.response';
import { CreatePostResponse } from '../presenters/create-post.response';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { CheckAbilities } from '../../../../../core/decorators/check-abilities.decorator';
import { Action } from '../../../../../core/access/actions.enum';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';
import { CaslAbilityFactory } from '../../../../../core/access/casl-ability.factory';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
@UseGuards(JwtAuthGuard, CaslGuard)
export class PostsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  @Post()
  @CheckAbilities({ action: Action.Create, subject: 'CONTENT' })
  @ApiOperation({
    summary: 'Create a new post (manual or AI-assisted)',
    description:
      'Creates a blog post.\n\n' +
      'Two mutually compatible flows:\n\n' +
      '1. Manual creation — client provides full postContent + SEO fields.\n\n' +
      '2. AI-assisted creation (recommended for speed) — set `generateWithAi: true`. The backend will:\n' +
      '   - Call Tavily for fresh research (E-E-A-T grounding)\n' +
      '   - Generate the full Markdown article + SEO fields with Gemini using the official 10 E-E-A-T writing rules\n' +
      '   - Optionally generate and upload a hero image to R2\n' +
      '   - All generation + external side-effects happen BEFORE the database transaction.\n\n' +
      'Client-provided values always override AI-generated ones (postContent, SEO fields, postCoverImage).\n\n' +
      'When using the AI flow you only need to send the title + generateWithAi (niche and wordCount are optional).\n\n' +
      'Requires valid GEMINI_API_KEY and TAVILY_API_KEY when generateWithAi is true.',
  })
  @ApiBody({
    description:
      'Post payload. Use generateWithAi for fully automated creation.',
    examples: {
      'Manual creation': {
        value: {
          postTitle: 'Guía completa de React Server Components',
          postContent: '# Introducción\n\n...',
          postStatus: 'draft',
          categoryId: 'uuid-of-category',
        },
      },
      'AI-assisted creation (minimal)': {
        value: {
          postTitle: 'Cómo optimizar el rendimiento de React en 2026',
          generateWithAi: true,
          aiNiche: 'Desarrollo Web',
          aiWordCount: 1400,
          postStatus: 'draft',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: CreatePostResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse()
  async create(
    @Body(new ZodValidationPipe(CreatePostSchema))
    dto: CreatePostDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreatePostResponse> {
    const id = await this.commandBus.execute(
      new CreatePostCommand(dto, user.id),
    );
    return { id };
  }

  @Post('ai/generate-preview')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @CheckAbilities({ action: Action.Create, subject: 'CONTENT' })
  @ApiOperation({
    summary: 'Generate post content with AI (Gemini + Tavily research)',
    description:
      'Triggers a full AI content generation pipeline for a blog post.\n\n' +
      'The system performs:\n' +
      '1. Web research via Tavily (E-E-A-T grounding)\n' +
      '2. Article generation with Google Gemini using the exact 10 E-E-A-T writing rules and SEO structure from the content pipeline spec\n' +
      '3. SEO metadata generation (slug, excerpt, meta title/description/keywords)\n' +
      '4. Hero image generation (when supported by the model) and upload to R2\n\n' +
      'The generated content is returned for human review/editing before final submission.\n\n' +
      'Rate limited to 5 requests per 60 seconds.\n\n' +
      'Requires valid GEMINI_API_KEY and TAVILY_API_KEY.',
  })
  @ApiBody({
    description: 'AI generation parameters',
    examples: {
      'React performance (Spanish tech niche)': {
        value: {
          topic:
            'Cómo optimizar el rendimiento de React en aplicaciones grandes',
          niche: 'Desarrollo Web',
          wordCount: 1400,
        },
      },
    },
  })
  @ApiOkResponse({
    type: GeneratePostPreviewResponse,
    description:
      'AI-generated post preview ready for review. Includes Markdown content, SEO fields, optional hero image URL, and research sources.',
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse()
  async generatePreview(
    @Body(new ZodValidationPipe(GeneratePostPreviewSchema))
    dto: GeneratePostPreviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GeneratePostPreviewResponse> {
    const preview = await this.commandBus.execute(
      new GeneratePostPreviewCommand(dto, user.id),
    );
    return {
      post_content: preview.postContent,
      post_title_slug: preview.postTitleSlug,
      post_excerpt: preview.postExcerpt,
      meta_title: preview.metaTitle,
      meta_description: preview.metaDescription,
      meta_keywords: preview.metaKeywords,
      generated_image_url: preview.generatedImageUrl,
      sources: preview.sources,
    };
  }

  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'CONTENT' })
  @ApiOkResponse({ type: PostListResponse })
  @ApiForbiddenResponse({
    description: '`onlyTrashed=true` requires `Action.Restore`',
  })
  @ApiQuery({
    name: 'postStatus',
    required: false,
    enum: ['draft', 'published', 'scheduled'],
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    format: 'uuid',
  })
  @ApiQuery({ name: 'userId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted posts alongside active ones.',
  })
  @ApiQuery({
    name: 'onlyTrashed',
    required: false,
    type: Boolean,
    description:
      'Return ONLY soft-deleted posts. Cannot be combined with `withTrashed`. Requires `Action.Restore`.',
  })
  @CacheTTL(TTL_SECONDS.SHORT)
  async findAll(
    @Query(new ZodValidationPipe(PostFiltersSchema)) query: PostFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<PostReadModel>> {
    await this.assertCanReadTrash(query.onlyTrashed, user);
    return this.queryBus.execute(new GetPostsListQuery(query));
  }

  @Get('export')
  @CheckAbilities({ action: Action.Read, subject: 'CONTENT' })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
  )
  @ApiOkResponse({ description: 'Binary file' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['csv', 'xlsx', 'pdf'],
    description: 'Export format. Defaults to `xlsx`.',
  })
  @ApiQuery({
    name: 'postStatus',
    required: false,
    enum: ['draft', 'published', 'scheduled'],
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    format: 'uuid',
  })
  @ApiQuery({ name: 'userId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted posts in the export.',
  })
  @ApiQuery({
    name: 'onlyTrashed',
    required: false,
    type: Boolean,
    description:
      'Export ONLY soft-deleted posts. Cannot be combined with `withTrashed`. Requires `Action.Restore`.',
  })
  @SkipCache()
  async export(
    @Query(new ZodValidationPipe(ExportPostsSchema))
    query: ExportPostsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    await this.assertCanReadTrash(query.onlyTrashed, user);
    const result = await this.queryBus.execute<
      ExportPostsQuery,
      ExportPostsResult
    >(new ExportPostsQuery(query, query.format, user.id));

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    return new StreamableFile(result.buffer);
  }

  @Get(':id')
  @CheckAbilities({ action: Action.Read, subject: 'CONTENT' })
  @ApiOkResponse({ type: PostResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'withTrashed',
    required: false,
    type: Boolean,
    description:
      'When `true`, return the post even if it has been soft-deleted.',
  })
  @CacheTTL(TTL_SECONDS.SHORT)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('withTrashed') withTrashedRaw?: string,
  ): Promise<PostReadModel> {
    const withTrashed = withTrashedRaw === 'true';
    return this.queryBus.execute(new GetPostByIdQuery(id, withTrashed));
  }

  @Patch(':id')
  @CheckAbilities({ action: Action.Update, subject: 'CONTENT' })
  @ApiOkResponse({ type: PostResponse })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePostSchema))
    dto: UpdatePostDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PostReadModel> {
    await this.commandBus.execute(new UpdatePostCommand(id, dto, user.id));
    return this.queryBus.execute(new GetPostByIdQuery(id));
  }

  @Patch(':id/restore')
  @CheckAbilities({ action: Action.Restore, subject: 'CONTENT' })
  @ApiOkResponse({
    description: 'Restored',
    schema: { example: { success: true } },
  })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.commandBus.execute(new RestorePostCommand(id, user.id));
    return { success: true };
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Delete, subject: 'CONTENT' })
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async bulkDelete(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.commandBus.execute(
      new BulkDeletePostsCommand(dto.ids, user.id),
    );
  }

  @Post('bulk-restore')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Restore, subject: 'CONTENT' })
  @ApiOkResponse({ schema: { example: { count: 3 } } })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async bulkRestore(
    @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.commandBus.execute(
      new BulkRestorePostsCommand(dto.ids, user.id),
    );
  }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'CONTENT' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(new DeletePostCommand(id, user.id));
  }

  private async assertCanReadTrash(
    onlyTrashed: boolean | undefined,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (!onlyTrashed) return;
    const ability = await this.abilityFactory.createForUser(user);
    if (!ability.can(Action.Restore, 'CONTENT')) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
