import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { AppModule } from '../../src/app.module';
import { PERMISSION_RESOLVER, type PermissionResolver } from '../../src/modules/access-control';
import { SOCIAL_VERIFIERS, type SocialVerifiers } from '../../src/modules/auth-users/domain/social';
import { MAIL_SENDER, type MailSender } from '../../src/common/mail/mail-sender';
import { InMemoryMailSender } from './in-memory-mail-sender';
import { CLOCK, type Clock } from '../../src/common/clock/clock';
import {
  AccessTokenGuard,
  CurrentUser,
  type AuthenticatedUser,
} from '../../src/modules/auth-users';
import { configureApp, createFastifyAdapter } from '../../src/bootstrap';
import { DATABASE_PING, type DatabasePing } from '../../src/common/health/database-ping';
import { ShutdownState } from '../../src/common/health/shutdown-state';
import { createLogger } from '../../src/common/logging/logger';
import { type AppConfig, loadConfig } from '../../src/config/app-config';

export class EchoDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

/** Test-only routes. They live here, never in src/. */
@Controller('__test')
export class TestController {
  @Post('echo')
  echo(@Body() dto: EchoDto): EchoDto {
    return dto;
  }

  /** Exercises AccessTokenGuard + @CurrentUser. */
  @Get('whoami')
  @UseGuards(AccessTokenGuard)
  whoami(@CurrentUser() user: AuthenticatedUser): { sub: string; tokenId: string } {
    return { sub: user.id, tokenId: user.tokenId };
  }

  @Get('boom')
  boom(): never {
    throw new Error('db connection failed: password=hunter2');
  }
}

export const TEST_JWT_SECRET = 'test-only-jwt-secret-0123456789abcdef';
export const UNREACHABLE_DATABASE_URL = 'postgres://rento:rento@127.0.0.1:1/rento';

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    DATABASE_URL: UNREACHABLE_DATABASE_URL,
    JWT_SECRET: TEST_JWT_SECRET,
    // Most tests change roles with raw SQL; they must see the change at once. The cache has its own tests.
    PERMISSION_CACHE_TTL_SECONDS: '0',
    // Background sweeps are driven explicitly by the tests that cover them.
    JOBS_INTERVAL_SECONDS: '0',
    // The identity gate has its own tests; everything else books without it.
    KYC_REQUIRED: 'false',
    // Request limits and lockout have their own tests; everything else signs in and books freely.
    RATE_LIMIT_ENABLED: 'false',
    // Production requires real mail/link settings (config rule); tests that flip NODE_ENV get harmless ones.
    ...(overrides['NODE_ENV'] === 'production' && {
      SMTP_HOST: '127.0.0.1',
      MAIL_FROM: 'Rento <no-reply@rento.example>',
      PUBLIC_WEB_URL: 'https://app.rento.example',
    }),
    ...overrides,
  });
}

export interface TestApp {
  app: NestFastifyApplication;
  /** Every log line pino wrote, raw. */
  logLines: string[];
  /** Parsed log records. */
  logs(): Array<Record<string, unknown>>;
  shutdownState: ShutdownState;
  /** Captures outgoing mail (unless a different sender was supplied). */
  mail: InMemoryMailSender;
}

export interface CreateTestAppOptions {
  config?: AppConfig;
  /** Replace the system clock (e.g. a FakeClock) for the whole app. */
  clock?: Clock;
  /** Replace the DB readiness probe. Omit to use the real pg-backed one. */
  databasePing?: DatabasePing & { onModuleDestroy?: () => unknown };
  /** Defaults to an in-memory sender so no test ever tries real SMTP. */
  mailSender?: MailSender;
  /** Keep the app's own mail sender (real SMTP per config) instead of the in-memory one. */
  realMail?: boolean;
  /** Enabled social-login verifiers (fakes). Omit to leave every provider unavailable. */
  socialVerifiers?: SocialVerifiers;
  /** Replaces the default deny-everyone permission resolver (the real engine is P2-12). */
  permissionResolver?: PermissionResolver;
}

export async function createTestApp(options: CreateTestAppOptions = {}): Promise<TestApp> {
  const config = options.config ?? testConfig();
  const logLines: string[] = [];
  const logger = createLogger(config, { write: (line: string) => void logLines.push(line) });

  let builder = Test.createTestingModule({
    imports: [AppModule.register(config)],
    controllers: [TestController],
  });
  if (options.databasePing) {
    builder = builder.overrideProvider(DATABASE_PING).useValue(options.databasePing);
  }
  if (options.clock) {
    builder = builder.overrideProvider(CLOCK).useValue(options.clock);
  }
  if (options.permissionResolver) {
    builder = builder.overrideProvider(PERMISSION_RESOLVER).useValue(options.permissionResolver);
  }
  if (options.socialVerifiers) {
    builder = builder.overrideProvider(SOCIAL_VERIFIERS).useValue(options.socialVerifiers);
  }
  const mail = new InMemoryMailSender();
  if (!options.realMail) {
    builder = builder.overrideProvider(MAIL_SENDER).useValue(options.mailSender ?? mail);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    createFastifyAdapter(logger),
    {
      rawBody: true,
    },
  );
  configureApp(app, config, logger);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    logLines,
    logs: () => logLines.map((line) => JSON.parse(line) as Record<string, unknown>),
    shutdownState: app.get(ShutdownState),
    mail,
  };
}
