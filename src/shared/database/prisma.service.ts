import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { LoggerService } from '../../logger/logger.service';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * Prisma 7 client bound to the `@prisma/adapter-pg` driver adapter.
 *
 * The ONLY place the generated Prisma client is instantiated. Repositories
 * inject this service; nothing else imports the generated client.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    const connectionString = config.get<string>('DATABASE_URL');
    super({
      adapter: new PrismaPg({ connectionString }),
    });
    this.logger.setContext(PrismaService.name);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.info('Prisma connected', { layer: 'database' });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.info('Prisma disconnected', { layer: 'database' });
  }
}
