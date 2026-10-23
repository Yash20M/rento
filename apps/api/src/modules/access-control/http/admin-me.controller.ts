import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Kysely } from 'kysely';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { mediaRef } from '../../../common/media/images';
import { PROBLEM_JSON, ProblemDetailsDto } from '../../../common/errors/problem.dto';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { PERMISSION_RESOLVER, type PermissionResolver } from '../domain/authorization';
import { PERMISSIONS } from '../domain/permissions';
import { PermissionGuard } from './permission.guard';
import { AllowWithoutMfa } from './allow-without-mfa.decorator';
import { RequireAdminAccess } from './require-permission.decorator';

class AdminIdentityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  email!: string | null;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Address of your profile photo, if any.',
  })
  avatarUrl!: string | null;
}

class MfaStateDto {
  @ApiProperty({ description: 'Administrators must pass the second step to use the panel.' })
  required!: boolean;

  @ApiProperty({ description: 'You have set up two-step verification.' })
  enrolled!: boolean;

  @ApiProperty({ description: 'This session has passed the second step.' })
  verified!: boolean;
}

class DrawerScopeDto {
  @ApiProperty({ example: 'bookings:cancel' })
  permission!: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'The only drawers this permission applies to.',
  })
  drawerIds!: string[];
}

export class AdminMeDto {
  @ApiProperty({ type: AdminIdentityDto })
  user!: AdminIdentityDto;

  @ApiProperty({ type: MfaStateDto })
  mfa!: MfaStateDto;

  @ApiProperty({ description: 'The Super Admin holds every permission, including future ones.' })
  superAdmin!: boolean;

  @ApiProperty({
    type: [String],
    description:
      'Every permission held (all catalog keys for a Super Admin). UI only: the API re-checks everything.',
  })
  permissions!: string[];

  @ApiProperty({
    type: [DrawerScopeDto],
    description: 'Only permissions that are limited to specific drawers appear here.',
  })
  drawerScopes!: DrawerScopeDto[];
}

/** What the admin SPA needs to build its navigation (README §13.5 point 4). */
@ApiTags('admin: access control')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin')
export class AdminMeController {
  constructor(
    @Inject(PERMISSION_RESOLVER) private readonly resolver: PermissionResolver,
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('me')
  @RequireAdminAccess()
  @AllowWithoutMfa()
  @ApiOkResponse({ type: AdminMeDto })
  @ApiResponse({
    status: 403,
    description: '`PERMISSION_DENIED` — the account holds no role, so it has no admin access.',
    content: { [PROBLEM_JSON]: { schema: { $ref: getSchemaPath(ProblemDetailsDto) } } },
  })
  async me(@CurrentUser() caller: AuthenticatedUser): Promise<AdminMeDto> {
    const effective = await this.resolver.effective(caller.id);
    const user = await this.db
      .selectFrom('users')
      .select(['id', 'email', 'display_name', 'avatar_media_id'])
      .where('id', '=', caller.id)
      .executeTakeFirstOrThrow();

    const enrolled = await this.db
      .selectFrom('user_mfa_totp')
      .select('user_id')
      .where('user_id', '=', caller.id)
      .where('confirmed_at', 'is not', null)
      .executeTakeFirst();

    const drawerScopes = [...effective.scopes]
      .flatMap(([permission, scope]) =>
        scope === 'all' ? [] : [{ permission, drawerIds: [...scope].sort() }],
      )
      .sort((a, b) => a.permission.localeCompare(b.permission));

    return {
      mfa: {
        required: this.config.adminMfaRequired,
        enrolled: enrolled !== undefined,
        verified: caller.mfaAt !== undefined,
      },
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_media_id ? mediaRef(user.avatar_media_id) : null,
      },
      superAdmin: effective.superAdmin,
      permissions: effective.superAdmin
        ? PERMISSIONS.map((permission) => permission.key)
        : [...effective.permissions].sort(),
      drawerScopes: effective.superAdmin ? [] : drawerScopes,
    };
  }
}
