import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AUTH_PROBLEMS, problem } from '../../../common/http/problem-response';
import { AccessScopes, PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { DashboardDto } from './dashboard.dto';

/** `/v1/admin/dashboard` — what is going on right now, limited to the drawers the administrator may see. */
@ApiTags('admin: dashboard')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly scopes: AccessScopes,
  ) {}

  @Get()
  @RequirePermission('bookings:read')
  @ApiOkResponse({ type: DashboardDto })
  @problem(403, AUTH_PROBLEMS)
  async summary(@CurrentUser() user: AuthenticatedUser): Promise<DashboardDto> {
    return this.dashboard.summary(await this.scopes.forUser(user.id, 'bookings:read'));
  }
}
