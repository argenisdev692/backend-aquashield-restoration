import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { cleanupOpenApiDoc } from 'nestjs-zod';

// Set required environment variables before importing AppModule
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy';
process.env.JWT_ACCESS_SECRET = 'dummy-secret-for-export-only-min-32-chars';
process.env.JWT_REFRESH_SECRET = 'dummy-secret-for-export-only-min-32-chars';
process.env.TOTP_ENCRYPTION_KEY = 'dummy-encryption-key-for-export-only-32-chars';
process.env.RESEND_API_KEY = 'dummy-key-for-export-only';
process.env.RESEND_FROM_EMAIL = 'noreply@example.com';
process.env.R2_ACCESS_KEY_ID = 'dummy-key-for-export';
process.env.R2_SECRET_ACCESS_KEY = 'dummy-secret-for-export';
process.env.R2_BUCKET_NAME = 'dummy-bucket';
process.env.R2_PUBLIC_BASE_URL = 'https://dummy.example.com';
process.env.GEMINI_API_KEY = 'dummy-key-for-export';
process.env.TAVILY_API_KEY = 'dummy-key-for-export';

import { AppModule } from '../src/app.module';

async function exportOpenApi() {

  const app = await NestFactory.create(AppModule);
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
  const cleanedDoc = cleanupOpenApiDoc(document, { version: '3.0' });

  const outputPath = './openapi.json';
  writeFileSync(outputPath, JSON.stringify(cleanedDoc, null, 2));
  console.log(`OpenAPI spec exported to ${outputPath}`);
  await app.close();
}

exportOpenApi().catch(console.error);
