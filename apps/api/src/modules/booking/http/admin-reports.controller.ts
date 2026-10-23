import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AUTH_PROBLEMS, problem } from '../../../common/http/problem-response';
import { AccessScopes, PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { AdminReportsService } from '../services/admin-reports.service';
import {
  PaymentLedgerPageDto,
  PaymentsQuery,
  ReportDto,
  ReportQuery,
  SettingsDto,
} from './admin-ops.dto';

/** Reports, the payments ledger and the settings overview (README §13.1). All limited to the administrator's drawers. */
@ApiTags('admin: reports')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin')
export class AdminReportsController {
  constructor(
    private readonly reports: AdminReportsService,
    private readonly scopes: AccessScopes,
  ) {}

  @Get('reports/summary')
  @RequirePermission('reports:read')
  @ApiOkResponse({
    type: ReportDto,
    description:
      'Bookings confirmed in the window: counts, hours rented and money (collected includes refundable deposits).',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(422, '`VALIDATION_FAILED` — bad times or a window longer than 366 days.')
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportQuery,
  ): Promise<ReportDto> {
    return this.reports.report(await this.scopes.forUser(user.id, 'reports:read'), query);
  }

  @Get('payments')
  @RequirePermission('reports:read')
  @ApiOkResponse({ type: PaymentLedgerPageDto, description: 'Newest first.' })
  @problem(403, AUTH_PROBLEMS)
  @problem(422, '`VALIDATION_FAILED` — bad filter or cursor.')
  async payments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaymentsQuery,
  ): Promise<PaymentLedgerPageDto> {
    return this.reports.payments(await this.scopes.forUser(user.id, 'reports:read'), query);
  }

  @Get('settings')
  @RequirePermission('settings:read')
  @ApiOkResponse({
    type: SettingsDto,
    description:
      'The rules in force. They come from the deployment environment and are read-only here.',
  })
  @problem(403, AUTH_PROBLEMS)
  settings(): Promise<SettingsDto> {
    return this.reports.settings();
  }
}
