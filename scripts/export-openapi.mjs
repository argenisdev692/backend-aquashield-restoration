import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { AppModule } from '../src/app.module';

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule);
  const config = new SwaggerModule().createDocument(app, {
    title: 'Aquashield Restoration LLC API',
    description: 'REST API — OpenAPI 3.0',
    version: '1.0',
    addBearerAuth: true,
  });

  const outputPath = './openapi.json';
  writeFileSync(outputPath, JSON.stringify(config, null, 2));
  console.log(`OpenAPI spec exported to ${outputPath}`);
  await app.close();
}

exportOpenApi().catch(console.error);
