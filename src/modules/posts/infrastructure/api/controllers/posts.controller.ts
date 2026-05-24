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

  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'CONTENT' })
  @ApiOkResponse({ type: PostListResponse })
  @ApiForbiddenResponse({
    description: '`onlyTrashed=true` requires `Action.Restore`',
  })
  @ApiQuery({ name: 'postStatus', required: false, enum: ['draft', 'published', 'scheduled'] })
  @ApiQuery({ name: 'categoryId', required: false, type: String, format: 'uuid' })
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
    description: 'Return ONLY soft-deleted posts. Cannot be combined with `withTrashed`. Requires `Action.Restore`.',
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
  @ApiQuery({ name: 'postStatus', required: false, enum: ['draft', 'published', 'scheduled'] })
  @ApiQuery({ name: 'categoryId', required: false, type: String, format: 'uuid' })
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
    description: 'Export ONLY soft-deleted posts. Cannot be combined with `withTrashed`. Requires `Action.Restore`.',
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
    description: 'When `true`, return the post even if it has been soft-deleted.',
  })
  @CacheTTL(TTL_SECONDS.SHORT)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('withTrashed') withTrashedRaw?: string,
  ): Promise<PostReadModel> {
    const withTrashed = withTrashedRaw === 'true';
    return this.queryBus.execute(
      new GetPostByIdQuery(id, withTrashed),
    );
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
    await this.commandBus.execute(
      new UpdatePostCommand(id, dto, user.id),
    );
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
