import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../shared/database/prisma.service';
import { REDIS_CLIENT } from '../../shared/cache/cache-ttl.constants';
import { SkipCache } from '../decorators/skip-cache.decorator';

/**
 * `GET /health` — liveness/readiness. Public, never cached (must reflect
 * live state). Checks the database and Redis connections.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  @SkipCache()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkRedis(),
    ]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    const ind = this.indicator.check('database');
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return ind.up();
    } catch (err) {
      return ind.down({ message: (err as Error).message });
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    const ind = this.indicator.check('redis');
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG'
        ? ind.up()
        : ind.down({ message: `unexpected ping reply: ${String(pong)}` });
    } catch (err) {
      return ind.down({ message: (err as Error).message });
    }
  }
}
