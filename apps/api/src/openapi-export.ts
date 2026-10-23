import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp, createFastifyAdapter } from './bootstrap';
import { createLogger } from './common/logging/logger';
import { loadConfig } from './config/app-config';
import { buildOpenApiDocument } from './openapi';

/**
 * Writes the OpenAPI document to the path in argv[2] — deterministic, no env vars, no DB connection
 * (the pool is lazy and never used). Consumed by `pnpm contracts:generate` / `contracts:check`.
 */
async function main(): Promise<void> {
  const out = process.argv[2];
  if (!out) {
    process.stderr.write('usage: node dist/openapi-export.js <output.json>\n');
    process.exit(2);
  }

  // Inert config: the app is booted only to read its route/DTO metadata.
  const config = loadConfig({
    NODE_ENV: 'development',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://export:export@127.0.0.1:1/export',
    JWT_SECRET: 'openapi-export-inert-secret-not-used-0000',
  });
  const logger = createLogger(config);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(config),
    createFastifyAdapter(logger),
    { logger: false },
  );
  try {
    configureApp(app, config, logger);
    await app.init();
    const document = buildOpenApiDocument(app);
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  } finally {
    await app.close();
  }
}

void main();
