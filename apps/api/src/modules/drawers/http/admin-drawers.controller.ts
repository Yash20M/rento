import { mediaRef } from '../../../common/media/images';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AUTH_PROBLEMS, problem, uuidParam } from '../../../common/http/problem-response';
import { AccessScopes, PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import type { ClosureRow } from '../data/drawer.repository';
import { closureNotFound, drawerNotFound } from '../domain/drawer-rules';
import { type DrawerDetails, DrawerService } from '../services/drawer.service';
import {
  ClosureDto,
  CreateClosureDto,
  CreateDrawerDto,
  DrawerDto,
  SetHoursDto,
  UpdateDrawerDto,
} from './drawers.dto';

const hhmm = (time: string): string => time.slice(0, 5);

export const drawerView = ({ drawer, hours, assetCount }: DrawerDetails): DrawerDto => ({
  id: drawer.id,
  name: drawer.name,
  address: drawer.address,
  timezone: drawer.timezone,
  latitude: drawer.latitude,
  longitude: drawer.longitude,
  status: drawer.status,
  pickupInstructions: drawer.pickup_instructions,
  photoUrl: drawer.photo_media_id ? mediaRef(drawer.photo_media_id) : null,
  hours: hours.map((h) => ({
    weekday: h.weekday,
    opensAt: hhmm(h.opens_at),
    closesAt: hhmm(h.closes_at),
  })),
  assetCount,
});

const closureView = (c: ClosureRow): ClosureDto => ({
  id: c.id,
  from: c.starts_at.toISOString(),
  to: c.ends_at.toISOString(),
  reason: c.reason,
});

/** `/v1/admin/drawers` — administrators limited to some drawers only see and change those (README §13.5). */
@ApiTags('admin: drawers')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/drawers')
export class AdminDrawersController {
  constructor(
    private readonly drawers: DrawerService,
    private readonly scopes: AccessScopes,
  ) {}

  @Get()
  @RequirePermission('drawers:read')
  @ApiOkResponse({ type: DrawerDto, isArray: true, description: 'Only drawers inside your scope.' })
  @problem(403, AUTH_PROBLEMS)
  async list(@CurrentUser() user: AuthenticatedUser): Promise<DrawerDto[]> {
    return (await this.drawers.list(await this.scopes.forUser(user.id, 'drawers:read'))).map(
      drawerView,
    );
  }

  @Get(':id')
  @RequirePermission('drawers:read')
  @ApiOkResponse({ type: DrawerDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND` — also for drawers outside your scope.')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(drawerNotFound)) id: string,
  ): Promise<DrawerDto> {
    return drawerView(
      await this.drawers.get(await this.scopes.forUser(user.id, 'drawers:read'), id),
    );
  }

  @Post()
  @RequirePermission('drawers:write')
  @ApiCreatedResponse({ type: DrawerDto })
  @problem(403, `${AUTH_PROBLEMS} Creating a drawer needs an unrestricted grant.`)
  @problem(422, '`VALIDATION_FAILED` — invalid coordinates, time zone or hours.')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Body() dto: CreateDrawerDto,
  ): Promise<DrawerDto> {
    const access = await this.scopes.forUser(user.id, 'drawers:write');
    return drawerView(await this.drawers.create({ id: user.id, ip }, access, dto));
  }

  @Patch(':id')
  @RequirePermission('drawers:write')
  @ApiOkResponse({ type: DrawerDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(409, '`HAS_FUTURE_BOOKINGS` — cannot set inactive while bookings are upcoming.')
  @problem(422, '`VALIDATION_FAILED`')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(drawerNotFound)) id: string,
    @Body() dto: UpdateDrawerDto,
  ): Promise<DrawerDto> {
    const access = await this.scopes.forUser(user.id, 'drawers:write');
    return drawerView(await this.drawers.update({ id: user.id, ip }, access, id, dto));
  }

  @Put(':id/hours')
  @RequirePermission('drawers:write')
  @ApiOkResponse({ type: DrawerDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(422, '`VALIDATION_FAILED` — duplicate weekday, or closing not after opening.')
  async setHours(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(drawerNotFound)) id: string,
    @Body() dto: SetHoursDto,
  ): Promise<DrawerDto> {
    const access = await this.scopes.forUser(user.id, 'drawers:write');
    return drawerView(await this.drawers.setHours({ id: user.id, ip }, access, id, dto.hours));
  }

  @Get(':id/closures')
  @RequirePermission('drawers:read')
  @ApiOkResponse({ type: ClosureDto, isArray: true })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  async closures(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(drawerNotFound)) id: string,
  ): Promise<ClosureDto[]> {
    const access = await this.scopes.forUser(user.id, 'drawers:read');
    return (await this.drawers.listClosures(access, id)).map(closureView);
  }

  @Post(':id/closures')
  @RequirePermission('drawers:write')
  @ApiCreatedResponse({ type: ClosureDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(422, '`VALIDATION_FAILED` — `to` not after `from`, or it overlaps another closure.')
  async addClosure(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(drawerNotFound)) id: string,
    @Body() dto: CreateClosureDto,
  ): Promise<ClosureDto> {
    const access = await this.scopes.forUser(user.id, 'drawers:write');
    return closureView(await this.drawers.addClosure({ id: user.id, ip }, access, id, dto));
  }

  @Delete(':id/closures/:closureId')
  @HttpCode(204)
  @RequirePermission('drawers:write')
  @ApiNoContentResponse({ description: 'Closure removed.' })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  async removeClosure(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(drawerNotFound)) id: string,
    @Param('closureId', uuidParam(closureNotFound)) closureId: string,
  ): Promise<void> {
    const access = await this.scopes.forUser(user.id, 'drawers:write');
    await this.drawers.removeClosure({ id: user.id, ip }, access, id, closureId);
  }
}
