import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../logger/logger.service';
import { MAILER } from './mailer.port';
import { ResendMailerAdapter } from './resend-mailer.adapter';
import { ConsoleMailerAdapter } from './console-mailer.adapter';

/**
 * Provider selector for the shared mailer.
 *
 * `EMAIL_PROVIDER=console` switches to {@link ConsoleMailerAdapter} (dev / E2E).
 * Anything else (including unset) falls back to {@link ResendMailerAdapter}.
 *
 * Both adapters are registered as providers so unit tests can override either
 * one with `overrideProvider(MAILER)` without re-wiring the module.
 */
const mailerProvider: Provider = {
  provide: MAILER,
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

@Global()
@Module({
  providers: [ResendMailerAdapter, ConsoleMailerAdapter, mailerProvider],
  exports: [MAILER],
})
export class EmailModule {}
