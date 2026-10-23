import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AUTH_PROBLEMS, problem, uuidParam } from '../../../common/http/problem-response';
import { AccessScopes, PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { assetNotFound } from '../domain/inventory-errors';
import { AssetTransferService } from '../services/asset-transfer.service';
import { StartTransferDto, TransferDto } from './inventory.dto';

const SCOPE = '`NOT_FOUND` — also for assets outside your drawers.';

/** Moving an asset to another drawer: start, then complete (or cancel). Needs `assets:transfer`. */
@ApiTags('admin: inventory')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/assets/:id/transfer')
export class AdminTransfersController {
  constructor(
    private readonly transfers: AssetTransferService,
    private readonly scopes: AccessScopes,
  ) {}

  @Get()
  @RequirePermission('assets:transfer')
  @ApiOkResponse({ type: TransferDto, description: 'The transfer in progress, or `null`.' })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  async current(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(assetNotFound)) id: string,
  ): Promise<TransferDto | null> {
    return this.transfers.current(await this.scopes.forUser(user.id, 'assets:transfer'), id);
  }

  @Post()
  @RequirePermission('assets:transfer')
  @ApiCreatedResponse({ type: TransferDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  @problem(
    409,
    '`HAS_FUTURE_BOOKINGS` — upcoming bookings or blocks; `IN_USE` — the asset is not available.',
  )
  @problem(422, '`VALIDATION_FAILED` — unknown drawer, the same drawer, or no reason.')
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(assetNotFound)) id: string,
    @Body() dto: StartTransferDto,
  ): Promise<TransferDto> {
    return this.transfers.start(
      { id: user.id, ip },
      await this.scopes.forUser(user.id, 'assets:transfer'),
      id,
      dto,
    );
  }

  @Post('complete')
  @HttpCode(200)
  @RequirePermission('assets:transfer')
  @ApiOkResponse({
    type: TransferDto,
    description: 'The asset now belongs to the destination drawer.',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  @problem(409, '`INVALID_STATE` — the asset is not being transferred.')
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(assetNotFound)) id: string,
  ): Promise<TransferDto> {
    return this.transfers.complete(
      { id: user.id, ip },
      await this.scopes.forUser(user.id, 'assets:transfer'),
      id,
    );
  }

  @Post('cancel')
  @HttpCode(200)
  @RequirePermission('assets:transfer')
  @ApiOkResponse({ type: TransferDto, description: 'The asset stays in its original drawer.' })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  @problem(409, '`INVALID_STATE` — the asset is not being transferred.')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(assetNotFound)) id: string,
  ): Promise<TransferDto> {
    return this.transfers.cancel(
      { id: user.id, ip },
      await this.scopes.forUser(user.id, 'assets:transfer'),
      id,
    );
  }
}
