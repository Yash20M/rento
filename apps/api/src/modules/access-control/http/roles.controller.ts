import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { PROBLEM_JSON, ProblemDetailsDto } from '../../../common/errors/problem.dto';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { permissionsByGroup } from '../domain/permissions';
import { roleNotFound } from '../domain/role-errors';
import type { RoleWithPermissions } from '../data/role.repository';
import { RoleService } from '../services/role.service';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './require-permission.decorator';
import { SuperAdminOnly } from './super-admin-only.decorator';
import { CreateRoleDto, PermissionGroupDto, RoleDto, UpdateRoleDto } from './roles.dto';

const problem = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    content: { [PROBLEM_JSON]: { schema: { $ref: getSchemaPath(ProblemDetailsDto) } } },
  });

const view = (role: RoleWithPermissions): RoleDto => ({
  id: role.id,
  name: role.name,
  description: role.description,
  isSystem: role.is_system,
  isSuperAdmin: role.is_super_admin,
  permissions: role.permissions,
  assignedCount: role.assignedCount,
  createdAt: role.created_at.toISOString(),
  updatedAt: role.updated_at.toISOString(),
});

const AUTH =
  '`UNAUTHENTICATED` / `TOKEN_EXPIRED` — missing, invalid or expired access token. `PERMISSION_DENIED` (403) — you lack the permission.';

/** `/v1/admin/roles` and `/v1/admin/permissions` (README §13.5). Deny by default: see PermissionGuard. */
@ApiTags('admin: access control')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin')
export class RolesController {
  constructor(private readonly roles: RoleService) {}

  @Get('permissions')
  @RequirePermission('roles:read')
  @ApiOkResponse({
    type: PermissionGroupDto,
    isArray: true,
    description: 'The permission catalog, grouped.',
  })
  @problem(403, AUTH)
  listPermissions(): PermissionGroupDto[] {
    return permissionsByGroup().map(({ group, permissions }) => ({
      group,
      permissions: permissions.map(({ key, description }) => ({ key, description })),
    }));
  }

  @Get('roles')
  @RequirePermission('roles:read')
  @ApiOkResponse({ type: RoleDto, isArray: true })
  @problem(403, AUTH)
  async list(): Promise<RoleDto[]> {
    return (await this.roles.list()).map(view);
  }

  @Get('roles/:id')
  @RequirePermission('roles:read')
  @ApiOkResponse({ type: RoleDto })
  @problem(403, AUTH)
  @problem(404, '`NOT_FOUND` — no such role.')
  async get(
    @Param('id', new ParseUUIDPipe({ exceptionFactory: roleNotFound })) id: string,
  ): Promise<RoleDto> {
    return view(await this.roles.get(id));
  }

  @Post('roles')
  @RequirePermission('roles:manage')
  @SuperAdminOnly()
  @ApiCreatedResponse({ type: RoleDto })
  @problem(403, AUTH)
  @problem(
    422,
    '`VALIDATION_FAILED` — duplicate name (field `name`), unknown permission (field `permissions`), or invalid fields.',
  )
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleDto> {
    return view(await this.roles.create({ id: user.id, ip }, dto));
  }

  @Patch('roles/:id')
  @RequirePermission('roles:manage')
  @SuperAdminOnly()
  @ApiOkResponse({ type: RoleDto })
  @problem(403, AUTH)
  @problem(404, '`NOT_FOUND` — no such role.')
  @problem(409, '`ROLE_LOCKED` — system roles (Super Admin) cannot be edited.')
  @problem(422, '`VALIDATION_FAILED` — duplicate name, unknown permission, or invalid fields.')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', new ParseUUIDPipe({ exceptionFactory: roleNotFound })) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleDto> {
    return view(await this.roles.update({ id: user.id, ip }, id, dto));
  }

  @Delete('roles/:id')
  @HttpCode(204)
  @RequirePermission('roles:manage')
  @SuperAdminOnly()
  @ApiNoContentResponse({ description: 'Role deleted.' })
  @problem(403, AUTH)
  @problem(404, '`NOT_FOUND` — no such role.')
  @problem(409, '`ROLE_LOCKED` — system role; `ROLE_IN_USE` — still assigned to people.')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', new ParseUUIDPipe({ exceptionFactory: roleNotFound })) id: string,
  ): Promise<void> {
    await this.roles.remove({ id: user.id, ip }, id);
  }
}
