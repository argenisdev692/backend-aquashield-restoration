import { BullModule } from '@nestjs/bullmq';
import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../logger/logger.service';
import { QUEUE_NAMES } from '../../messaging/queues.constants';
import { EmailProcessor } from './email.processor';
import { MAILER, MAILER_TRANSPORT } from './mailer.port';
import { QueuedMailerAdapter } from './queued-mailer.adapter';
import { ResendMailerAdapter } from './resend-mailer.adapter';
import { ConsoleMailerAdapter } from './console-mailer.adapter';

/**
 * Low-level transport selector.
 *
 * `EMAIL_PROVIDER=console` switches to {@link ConsoleMailerAdapter} (dev / E2E).
 * Anything else (including unset) falls back to {@link ResendMailerAdapter}.
 *
 * Bound to {@link MAILER_TRANSPORT} — injected ONLY by the queue worker
 * (`EmailProcessor`). Application code injects {@link MAILER} (the queued
 * facade) instead.
 */
const transportProvider: Provider = {
  provide: MAILER_TRANSPORT,
  inject: [ConfigService, LoggerService, ClsService],
  useFactory: (
    config: ConfigService,
    logger: LoggerService,
    cls: ClsService,
  ): ResendMailerAdapter | ConsoleMailerAdapter => {
    const provider = config
      .get<string>('EMAIL_PROVIDER', 'resend')
      .toLowerCase();
    if (provider === 'console') {
      return new ConsoleMailerAdapter(logger, cls);
    }
    const adapter = new ResendMailerAdapter(config, logger, cls);
    adapter.onModuleInit();
    return adapter;
  },
};

/**
 * Public mailer — the queued facade. Every consumer injects {@link MAILER}
 * and its `send()` enqueues onto the shared `email` BullMQ queue (with
 * synchronous fallback). See {@link QueuedMailerAdapter}.
 */
const mailerProvider: Provider = {
  provide: MAILER,
  useExisting: QueuedMailerAdapter,
};

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL })],
  providers: [
    transportProvider,
    QueuedMailerAdapter,
    mailerProvider,
    EmailProcessor,
  ],
  exports: [MAILER],
})
export class EmailModule {}
