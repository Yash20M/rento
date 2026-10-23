import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';
import { MediaModule } from './common/media/media.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { ClockModule } from './common/clock/clock.module';
import { MailModule } from './common/mail/mail.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { HealthModule } from './common/health/health.module';
import { createValidationPipe } from './common/pipes/validation.pipe';
import type { AppConfig } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './db/database.module';
import { AccessControlModule } from './modules/access-control';
import { BookingModule } from './modules/booking';
import { DrawersModule } from './modules/drawers';
import { InventoryModule } from './modules/inventory';
import { KycModule } from './modules/kyc';
import { ReportingAuditModule } from './modules/reporting-audit';
import { AuditViewerModule } from './modules/reporting-audit/audit-viewer.module';
import { AuthUsersModule } from './modules/auth-users';

@Module({
  imports: [
    ClockModule,
    RateLimitModule,
    MediaModule,
    DatabaseModule,
    MailModule,
    AuthUsersModule,
    ReportingAuditModule,
    AuditViewerModule,
    AccessControlModule,
    InventoryModule,
    DrawersModule,
    KycModule,
    BookingModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return { module: AppModule, imports: [ConfigModule.forRoot(config)] };
  }
}
