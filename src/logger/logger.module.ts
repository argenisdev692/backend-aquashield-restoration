import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { buildPinoParams } from './pino.config';
import { LoggerService } from './logger.service';

/**
 * Global logging module.
 *
 * Configures Pino once for the whole app and exposes {@link LoggerService}
 * as the single injectable logging API. Imported by AppModule.
 */
@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildPinoParams({
          isProduction: config.get<string>('NODE_ENV') === 'production',
          logLevel:
            config.get<string>('LOG_LEVEL') ??
            (config.get<string>('NODE_ENV') === 'production' ? 'info' : 'debug'),
        }),
    }),
  ],
  providers: [LoggerService],
  exports: [LoggerService, PinoLoggerModule],
})
export class LoggerModule {}
