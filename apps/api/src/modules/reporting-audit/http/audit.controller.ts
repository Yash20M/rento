import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AppError } from '../../../common/errors/app-error';
import { AUTH_PROBLEMS, problem } from '../../../common/http/problem-response';
import { AccessScopes, PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { AuditQueryService } from '../audit-query.service';
import { AuditPageDto, AuditQuery } from './audit.dto';

/** `/v1/admin/audit-logs` — the trail is not drawer-scoped, so only an unrestricted `audit:read` grant may read it. */
@ApiTags('admin: audit')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(
    private readonly audit: AuditQueryService,
    private readonly scopes: AccessScopes,
  ) {}

  @Get()
  @RequirePermission('audit:read')
  @ApiOkResponse({
    type: AuditPageDto,
    description: 'Newest first; pass `nextCursor` as `cursor` for the next page.',
  })
  @problem(403, `${AUTH_PROBLEMS} A grant limited to some drawers cannot read the trail.`)
  @problem(422, '`VALIDATION_FAILED` — bad filter or cursor.')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AuditQuery,
  ): Promise<AuditPageDto> {
    const access = await this.scopes.forUser(user.id, 'audit:read');
    if (access.kind !== 'all') {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        detail: 'The audit log can only be read with an unrestricted grant',
      });
    }
    return this.audit.list(query);
  }
}
