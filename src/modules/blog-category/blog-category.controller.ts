import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  Req,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../core/guards/casl.guard';
import { CheckAbilities } from '../../core/decorators/check-abilities.decorator';
import { Action } from '../../core/access/actions.enum';
import { SkipCache } from '../../core/decorators/skip-cache.decorator';
import { TTL_SECONDS } from '../../shared/cache/cache-ttl.constants';
import { BlogCategoryService } from './blog-category.service';
import { CreateBlogCategorySchema } from './dto/create-blog-category.dto';
import type { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { UpdateBlogCategorySchema } from './dto/update-blog-category.dto';
import type { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';
import { BlogCategoryResponse } from './blog-category.entity';

@ApiTags('blog-categories')
@ApiBearerAuth()
@Controller('blog-categories')
@UseGuards(JwtAuthGuard, CaslGuard)
export class BlogCategoryController {
  constructor(private readonly service: BlogCategoryService) {}

  @Post()
  @ApiCreatedResponse({ type: BlogCategoryResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @CheckAbilities({ action: Action.Create, subject: 'BLOG_CATEGORY' })
  async create(
    @Req() req: { user: { id: string } },
    @Body(new ZodValidationPipe(CreateBlogCategorySchema)) dto: CreateBlogCategoryDto,
  ): Promise<BlogCategoryResponse> {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  @ApiOkResponse({ type: [BlogCategoryResponse] })
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @CheckAbilities({ action: Action.Read, subject: 'BLOG_CATEGORY' })
  async findAll(): Promise<BlogCategoryResponse[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: BlogCategoryResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @CheckAbilities({ action: Action.Read, subject: 'BLOG_CATEGORY' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BlogCategoryResponse> {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: BlogCategoryResponse })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CheckAbilities({ action: Action.Update, subject: 'BLOG_CATEGORY' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateBlogCategorySchema)) dto: UpdateBlogCategoryDto,
  ): Promise<BlogCategoryResponse> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  @CheckAbilities({ action: Action.Delete, subject: 'BLOG_CATEGORY' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }

  @Post(':id/restore')
  @ApiOkResponse({ type: BlogCategoryResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @SkipCache()
  @CheckAbilities({ action: Action.Restore, subject: 'BLOG_CATEGORY' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BlogCategoryResponse> {
    return this.service.restore(id);
  }
}
