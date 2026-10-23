import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AppError } from '../../../common/errors/app-error';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AUTH_PROBLEMS, problem } from '../../../common/http/problem-response';
import { AccessScopes, PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { CustomerService } from '../services/customer.service';
import { KycService } from '../services/kyc.service';
import { kycView } from './kyc-view';
import {
  CustomerDetailDto,
  AccountStatusDto,
  CustomerPageDto,
  CustomersQuery,
  KycDecisionDto,
  KycStatusDto,
} from './kyc.dto';

const notFound = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'Customer not found' });

/**
 * `/v1/admin/customers` — people and their identity verification. Customers are not tied to a drawer, so only an
 * unrestricted grant may use this (a drawer-limited grant is refused).
 */
@ApiTags('admin: customers')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(
    private readonly customers: CustomerService,
    private readonly kyc: KycService,
    private readonly scopes: AccessScopes,
  ) {}

  private async unrestricted(userId: string, permission: string): Promise<void> {
    const access = await this.scopes.forUser(userId, permission);
    if (access.kind !== 'all') {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        detail: 'Customers can only be managed with an unrestricted grant',
      });
    }
  }

  @Get()
  @RequirePermission('users:read')
  @ApiOkResponse({
    type: CustomerPageDto,
    description: 'Newest first; pass `nextCursor` as `cursor` for the next page.',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(422, '`VALIDATION_FAILED` — bad filter or cursor.')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CustomersQuery,
  ): Promise<CustomerPageDto> {
    await this.unrestricted(user.id, 'users:read');
    return this.customers.list(query);
  }

  @Get(':id')
  @RequirePermission('users:read')
  @ApiOkResponse({ type: CustomerDetailDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CustomerDetailDto> {
    await this.unrestricted(user.id, 'users:read');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
    return this.customers.get(id);
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequirePermission('users:write')
  @ApiOkResponse({
    type: CustomerDetailDto,
    description:
      'Suspending signs the customer out everywhere and blocks new bookings; existing bookings are untouched. Staff accounts are refused.',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(409, '`INVALID_STATE` — this person is a staff member.')
  @problem(422, '`VALIDATION_FAILED` — a reason is required.')
  async setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id') id: string,
    @Body() dto: AccountStatusDto,
  ): Promise<CustomerDetailDto> {
    await this.unrestricted(user.id, 'users:write');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
    return this.customers.setStatus(
      { id: user.id, ip },
      id,
      dto.status as 'active' | 'suspended',
      dto.reason,
    );
  }

  @Post(':id/kyc')
  @HttpCode(200)
  @RequirePermission('users:write')
  @ApiOkResponse({
    type: KycStatusDto,
    description: 'The new state. Approving by hand records the staff member and the reason.',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(422, '`VALIDATION_FAILED` — a reason is required.')
  async decide(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id') id: string,
    @Body() dto: KycDecisionDto,
  ): Promise<KycStatusDto> {
    await this.unrestricted(user.id, 'users:write');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
    return kycView(await this.kyc.decide({ id: user.id, ip }, id, dto.decision, dto.reason));
  }
}
