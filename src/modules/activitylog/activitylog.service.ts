import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityLogRepository } from './activitylog.repository';
import type { ActivityLog } from './activitylog.entity';
import type { ActivityLogFilterDto } from './dto/activitylog-filter.dto';
import { LoggerService } from '../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import {
  resolveDateRange,
  type DateRange,
} from '../../shared/crud/date-range.util';

@Injectable()
export class ActivityLogService {
  constructor(
    private readonly repository: ActivityLogRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ActivityLogService.name);
  }

  async findById(id: string): Promise<ActivityLog> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ActivityLogService.findById', { traceId, id });
    return this.findOrFail(id);
  }

  async findAll(
    filter: ActivityLogFilterDto,
  ): Promise<{ data: ActivityLog[]; total: number }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ActivityLogService.findAll', {
      traceId,
      page: filter.page,
      limit: filter.limit,
      actorId: filter.actorId,
      action: filter.action,
      resourceId: filter.resourceId,
    });

    const range = resolveDateRange({
      start_date: filter.start_date,
      end_date: filter.end_date,
    });

    return this.repository.findAll(filter, range);
  }

  async delete(id: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ActivityLogService.delete start', { traceId, id });
    await this.findOrFail(id);
    await this.repository.delete(id);
    this.logger.info('ActivityLogService.delete end', { traceId, id });
  }

  private async findOrFail(id: string): Promise<ActivityLog> {
    const result = await this.repository.findById(id);
    if (!result) throw new NotFoundException('Activity log not found');
    return result;
  }
}
