import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp, createFastifyAdapter } from './bootstrap';
import { ShutdownState } from './common/health/shutdown-state';
import { createLogger } from './common/logging/logger';
import { registerShutdownSignals } from './common/shutdown';
import { type AppConfig, ConfigError, loadConfig } from './config/app-config';

function readConfig(): AppConfig {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

async function bootstrap(): Promise<void> {
  const config = readConfig();
  const logger = createLogger(config);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(config),
    createFastifyAdapter(logger, config.trustProxy),
    { bufferLogs: true, rawBody: true },
  );
  configureApp(app, config, logger);

  registerShutdownSignals(app, {
    beforeClose: () => app.get(ShutdownState).beginDraining(),
    log: { log: (m) => logger.info(m), error: (m) => logger.error(m) },
  });

  await app.listen({ host: config.host, port: config.port });
}

void bootstrap();
