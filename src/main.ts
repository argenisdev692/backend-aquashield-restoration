import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import helmet from 'helmet';
import hpp from 'hpp';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './shared/websockets/redis-io.adapter';
import { Request, Response, NextFunction } from 'express';

function corsOrigin(raw: string): boolean | string[] {
  if (raw.trim() === '*') return true;
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  // Security middleware (OWASP #5).
  app.use(helmet());
  app.use(hpp());

  // Redirect root to /api/docs
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/') {
      return res.redirect(301, '/api/docs');
    }
    next();
  });

  const origin = corsOrigin(config.get<string>('CORS_ORIGINS', '*'));
  const wildcardOrigin = origin === true;
  if (wildcardOrigin && isProd) {
    app
      .get(Logger)
      .warn(
        'CORS_ORIGINS is "*" in production — set an explicit allowlist. ' +
          'Credentials are disabled while the origin is a wildcard.',
      );
  }
  app.enableCors({
    origin,
    // Never reflect credentials with a wildcard origin: that would expose
    // cookies/Authorization to any site (OWASP Broken Access Control / CSRF).
    credentials: !wildcardOrigin,
  });

  app.setGlobalPrefix(config.get<string>('GLOBAL_PREFIX', 'api/v1'));
  app.enableShutdownHooks();

  // Fan out Socket.IO rooms across pods via the shared Redis connection.
  const ioAdapter = new RedisIoAdapter(app);
  await ioAdapter.connectToRedis();
  app.useWebSocketAdapter(ioAdapter);

  if (config.get<boolean>('SWAGGER_ENABLED')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Aquashield Restoration LLC API')
      .setDescription('REST API — OpenAPI 3.0')
      .setVersion('1.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token (without "Bearer " prefix)',
        in: 'header',
      })
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    // nestjs-zod v5: patchNestjsSwagger was replaced by cleanupOpenApiDoc,
    // applied to the generated doc before SwaggerModule.setup.
    SwaggerModule.setup(
      'api/docs',
      app,
      cleanupOpenApiDoc(document, { version: '3.0' }),
      {
        // Keep the entered Bearer token across page reloads so testers don't
        // have to re-Authorize after every refresh of /api/docs.
        swaggerOptions: { persistAuthorization: true },
      },
    );
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  if (!isProd) {
    const logger = app.get(Logger);
    logger.log(`Application listening on http://localhost:${port}`);
  }
}

void bootstrap();
