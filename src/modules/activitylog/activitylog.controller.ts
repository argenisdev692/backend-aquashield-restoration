import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CaslGuard } from '../../core/guards/casl.guard';
import { CheckAbilities } from '../../core/decorators/check-abilities.decorator';
import { Action } from '../../core/access/actions.enum';
import { ActivityLogService } from './activitylog.service';
import { ActivityLogResponse } from './dto/activitylog-response.dto';
import { ActivityLogFilterSchema } from './dto/activitylog-filter.dto';
import type { ActivityLogFilterDto } from './dto/activitylog-filter.dto';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@Controller('activity-logs')
@UseGuards(JwtAuthGuard, CaslGuard)
export class ActivityLogController {
  constructor(private readonly service: ActivityLogService) {}

  @Get()
  @ApiOkResponse({ type: [ActivityLogResponse] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'actorId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'resourceId', required: false, type: String })
  @ApiQuery({ name: 'start_date', required: false, type: Date })
  @ApiQuery({ name: 'end_date', required: false, type: Date })
  @CheckAbilities({ action: Action.Manage, subject: 'ACTIVITY_LOG' })
  async findAll(
    @Query(new ZodValidationPipe(ActivityLogFilterSchema))
    query: ActivityLogFilterDto,
  ): Promise<{ data: ActivityLogResponse[]; total: number }> {
    const result = await this.service.findAll(query);
    return {
      data: result.data,
      total: result.total,
    };
  }

  @Get(':id')
  @ApiOkResponse({ type: ActivityLogResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CheckAbilities({ action: Action.Manage, subject: 'ACTIVITY_LOG' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ActivityLogResponse> {
    return this.service.findById(id);
  }

  @Delete(':id')
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  @CheckAbilities({ action: Action.Manage, subject: 'ACTIVITY_LOG' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.delete(id);
  }
}
