import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppError } from '../../../common/errors/app-error';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AUTH_PROBLEMS, problem, uuidParam } from '../../../common/http/problem-response';
import { AccessScopes, PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { AdminOpsService } from '../services/admin-ops.service';
import {
  BlockDto,
  CreateBlockDto,
  ImpactDto,
  ScheduleDto,
  ScheduleQuery,
  WindowQuery,
} from './admin-ops.dto';

const notFound = () => new AppError({ status: 404, code: 'NOT_FOUND', detail: 'Not found' });
const SCOPE = '`NOT_FOUND` — also for units and drawers outside your scope.';

/** Maintenance blocks and the day's schedule (README §9.9, §13.3). */
@ApiTags('admin: operations')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin')
export class AdminOpsController {
  constructor(
    private readonly ops: AdminOpsService,
    private readonly scopes: AccessScopes,
  ) {}

  @Get('assets/:id/blocks')
  @RequirePermission('assets:read')
  @ApiOkResponse({ type: BlockDto, isArray: true, description: 'Blocks that have not ended yet.' })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  async blocks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(notFound)) id: string,
  ): Promise<BlockDto[]> {
    return this.ops.listBlocks(await this.scopes.forUser(user.id, 'assets:read'), id);
  }

  @Get('assets/:id/impact-preview')
  @RequirePermission('bookings:read')
  @ApiOkResponse({
    type: ImpactDto,
    description:
      'The bookings and blocks that stand in the way of blocking the unit for this time.',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  @problem(422, '`VALIDATION_FAILED` — bad or reversed times.')
  async preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(notFound)) id: string,
    @Query() query: WindowQuery,
  ): Promise<ImpactDto> {
    return this.ops.preview(
      await this.scopes.forUser(user.id, 'bookings:read'),
      id,
      query.startsAt,
      query.endsAt,
    );
  }

  @Post('assets/:id/blocks')
  @RequirePermission('assets:write')
  @ApiCreatedResponse({ type: BlockDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  @problem(
    409,
    '`HAS_FUTURE_BOOKINGS` — bookings or another block are in the way; the field errors name them. Nothing is cancelled for you.',
  )
  @problem(422, '`VALIDATION_FAILED` — bad times, a past block, a missing reason.')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(notFound)) id: string,
    @Body() dto: CreateBlockDto,
  ): Promise<BlockDto> {
    return this.ops.createBlock(
      { id: user.id, ip },
      await this.scopes.forUser(user.id, 'assets:write'),
      id,
      dto,
    );
  }

  @Delete('assets/:id/blocks/:blockId')
  @HttpCode(204)
  @RequirePermission('assets:write')
  @ApiNoContentResponse({ description: 'The block is lifted; the unit can be booked again.' })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  async release(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(notFound)) id: string,
    @Param('blockId', uuidParam(notFound)) blockId: string,
  ): Promise<void> {
    await this.ops.releaseBlock(
      { id: user.id, ip },
      await this.scopes.forUser(user.id, 'assets:write'),
      id,
      blockId,
    );
  }

  @Get('drawers/:id/schedule')
  @RequirePermission('bookings:read')
  @ApiOkResponse({
    type: ScheduleDto,
    description:
      'Every unit of the drawer with what occupies it in the window (bookings with their cleaning buffer, blocks).',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  @problem(422, '`VALIDATION_FAILED` — bad times or a window longer than 31 days.')
  async schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(notFound)) id: string,
    @Query() query: ScheduleQuery,
  ): Promise<ScheduleDto> {
    return this.ops.schedule(
      await this.scopes.forUser(user.id, 'bookings:read'),
      id,
      query.startsAt,
      query.endsAt,
    );
  }
}
