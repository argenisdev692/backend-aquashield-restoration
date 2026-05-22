import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';
import type Redis from 'ioredis';
import type { INestApplicationContext } from '@nestjs/common';
import { REDIS_CLIENT } from '../cache/cache-ttl.constants';
import { LoggerService } from '../../logger/logger.service';

/**
 * Socket.IO adapter backed by the shared `REDIS_CLIENT` ioredis connection.
 *
 * Without this, every pod keeps its own in-memory room map and a
 * `server.to('appointments:admin').emit(...)` from pod A never reaches a
 * client connected to pod B. The pub/sub channels are derived from the
 * shared cache client via `duplicate()` so we don't fan out a second URL
 * config.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  async connect(): Promise<void> {
    const logger = this.app.get(LoggerService);
    logger.setContext(RedisIoAdapter.name);

    const base = this.app.get<Redis>(REDIS_CLIENT);
    const pub = base.duplicate();
    const sub = base.duplicate();

    pub.on('error', (err: Error) =>
      logger.error('Socket.IO Redis pub error', {
        layer: 'ws',
        error: err.message,
      }),
    );
    sub.on('error', (err: Error) =>
      logger.error('Socket.IO Redis sub error', {
        layer: 'ws',
        error: err.message,
      }),
    );

    await Promise.all([pub.ping(), sub.ping()]);
    this.adapterConstructor = createAdapter(pub, sub);

    logger.info('Socket.IO Redis adapter connected', { layer: 'ws' });
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options) as {
      adapter: (a: ReturnType<typeof createAdapter>) => void;
      of: (ns: string) => { adapter: (a: ReturnType<typeof createAdapter>) => void };
    };
    server.adapter(this.adapterConstructor);
    return server;
  }
}
