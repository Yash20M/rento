import { Global, Module } from '@nestjs/common';
import { CLOCK, type Clock } from '../../common/clock/clock';
import { AuditLog } from './audit-log';

/** Audit writer (P2-14, lean) and later the audit viewer and report read models (P2-33/34). Global: any module audits. */
@Global()
@Module({
  providers: [
    { provide: AuditLog, useFactory: (clock: Clock) => new AuditLog(clock), inject: [CLOCK] },
  ],
  exports: [AuditLog],
})
export class ReportingAuditModule {}
