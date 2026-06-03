import { Module } from '@nestjs/common';
import { ActivityLogController } from './activitylog.controller';
import { ActivityLogService } from './activitylog.service';
import { ActivityLogRepository } from './activitylog.repository';

@Module({
  controllers: [ActivityLogController],
  providers: [ActivityLogService, ActivityLogRepository],
})
export class ActivityLogsModule {}
