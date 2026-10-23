import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AUTH_PROBLEMS, problem } from '../../../common/http/problem-response';
import { PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { DISCOVERY_BOUNDS, DiscoverySettings } from '../services/discovery-settings';

export class DiscoverySettingsDto {
  @ApiProperty({
    minimum: DISCOVERY_BOUNDS.radiusMeters.min,
    maximum: DISCOVERY_BOUNDS.radiusMeters.max,
    description: 'How far from the customer a drawer may be to be offered, in metres.',
  })
  @IsInt()
  @Min(DISCOVERY_BOUNDS.radiusMeters.min)
  @Max(DISCOVERY_BOUNDS.radiusMeters.max)
  radiusMeters!: number;

  @ApiProperty({
    minimum: DISCOVERY_BOUNDS.maxResults.min,
    maximum: DISCOVERY_BOUNDS.maxResults.max,
    description: 'How many open drawers the app is shown at most.',
  })
  @IsInt()
  @Min(DISCOVERY_BOUNDS.maxResults.min)
  @Max(DISCOVERY_BOUNDS.maxResults.max)
  maxResults!: number;
}

/** `/v1/admin/settings/discovery` — the rules for which drawers a customer is offered (README §10.3). */
@ApiTags('admin: settings')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/settings/discovery')
export class AdminSettingsController {
  constructor(private readonly settings: DiscoverySettings) {}

  @Get()
  @RequirePermission('settings:read')
  @ApiOkResponse({ type: DiscoverySettingsDto })
  @problem(403, AUTH_PROBLEMS)
  current(): Promise<DiscoverySettingsDto> {
    return this.settings.current();
  }

  @Put()
  @RequirePermission('settings:write')
  @ApiOkResponse({ type: DiscoverySettingsDto, description: 'Applies to the very next search.' })
  @problem(403, AUTH_PROBLEMS)
  @problem(422, '`VALIDATION_FAILED` — a value is outside its allowed range.')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Body() dto: DiscoverySettingsDto,
  ): Promise<DiscoverySettingsDto> {
    return this.settings.update({ id: user.id, ip }, dto);
  }
}
