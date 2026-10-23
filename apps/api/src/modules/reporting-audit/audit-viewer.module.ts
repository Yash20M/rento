import { Module } from '@nestjs/common';
import { AuditQueryService } from './audit-query.service';
import { AuditController } from './http/audit.controller';

/**
 * The audit viewer (`GET /v1/admin/audit-logs`). Kept apart from `ReportingAuditModule` (which the access-control
 * module depends on for writing audit rows) so the two never import each other in a cycle.
 */
@Module({ controllers: [AuditController], providers: [AuditQueryService] })
export class AuditViewerModule {}
