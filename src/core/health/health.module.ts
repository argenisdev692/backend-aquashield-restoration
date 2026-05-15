import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/**
 * Health module — exposes `GET /health`. DatabaseModule + CacheModule are
 * @Global, so PrismaService / REDIS_CLIENT are available without re-import.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
