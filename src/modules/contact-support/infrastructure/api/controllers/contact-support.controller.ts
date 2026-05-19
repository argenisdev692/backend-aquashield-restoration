import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
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
  ApiQuery,
} from '@nestjs/swagger';
import { TTL_SECONDS } from '../../../../../shared/cache/cache-ttl.constants';
import { ZodValidationPipe } from '../../../../../core/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../../../../core/guards/casl.guard';
import { CheckAbilities } from '../../../../../core/decorators/check-abilities.decorator';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { Action } from '../../../../../core/access/actions.enum';
import type { AuthenticatedUser } from '../../../../../core/access/actions.enum';
import { CreateContactSupportCommand } from '../../../application/commands/impl/create-contact-support.command';
import { MarkContactSupportReadCommand } from '../../../application/commands/impl/mark-contact-support-read.command';
import { DeleteContactSupportCommand } from '../../../application/commands/impl/delete-contact-support.command';
import { RestoreContactSupportCommand } from '../../../application/commands/impl/restore-contact-support.command';
import { GetContactSupportByIdQuery } from '../../../application/queries/impl/get-contact-support-by-id.query';
import { ListContactSupportQuery } from '../../../application/queries/impl/list-contact-support.query';
import {
  CreateContactSupportDto,
  CreateContactSupportSchema,
} from '../../../application/dtos/create-contact-support.dto';
import {
  ListContactSupportDto,
  ListContactSupportSchema,
} from '../../../application/dtos/list-contact-support.dto';
import {
  ContactSupportResponse,
  ContactSupportListResponse,
  CreateContactSupportResponse,
} from '../presenters/contact-support.response';
import type { ContactSupportReadModel } from '../../../domain/read-models/contact-support.read-model';
import type { PaginatedContactSupport } from '../../../domain/read-models/contact-support.read-model';

@ApiTags('contact-support')
@Controller('contact-support')
export class ContactSupportController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ── Public — anonymous contact form ───────────────────────────
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiCreatedResponse({ type: CreateContactSupportResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async create(
    @Body(new ZodValidationPipe(CreateContactSupportSchema))
    dto: CreateContactSupportDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<CreateContactSupportResponse> {
    const id = await this.commandBus.execute<
      CreateContactSupportCommand,
      string
    >(
      new CreateContactSupportCommand(
        dto.firstName,
        dto.lastName,
        dto.email,
        dto.phone,
        dto.subject,
        dto.message,
        dto.smsConsent,
        user?.id,
      ),
    );
    return { id };
  }

  // ── Admin — super-admin / admin only (CASL: CONTACT) ──────────
  @Get()
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'CONTACT' })
  @ApiOkResponse({ type: ContactSupportListResponse })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'readed', required: false, enum: ['true', 'false'] })
  list(
    @Query(new ZodValidationPipe(ListContactSupportSchema))
    query: ListContactSupportDto,
  ): Promise<PaginatedContactSupport> {
    return this.queryBus.execute<
      ListContactSupportQuery,
      PaginatedContactSupport
    >(new ListContactSupportQuery(query.page, query.limit, query.readed));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'CONTACT' })
  @ApiOkResponse({ type: ContactSupportResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContactSupportReadModel> {
    return this.queryBus.execute<
      GetContactSupportByIdQuery,
      ContactSupportReadModel
    >(new GetContactSupportByIdQuery(id));
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @CheckAbilities({ action: Action.Update, subject: 'CONTACT' })
  @ApiOkResponse({ description: 'Marked as read' })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.commandBus.execute<MarkContactSupportReadCommand, void>(
      new MarkContactSupportReadCommand(id, user.id),
    );
    return { success: true };
  }

  @Patch(':id/restore')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @CheckAbilities({ action: Action.Restore, subject: 'CONTACT' })
  @ApiOkResponse({ description: 'Restored' })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.commandBus.execute<RestoreContactSupportCommand, void>(
      new RestoreContactSupportCommand(id, user.id),
    );
    return { success: true };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  @CheckAbilities({ action: Action.Delete, subject: 'CONTACT' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute<DeleteContactSupportCommand, void>(
      new DeleteContactSupportCommand(id, user.id),
    );
  }
}
