import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import type { AdminRow } from '../data/admin.repository';
import type { InvitationRow } from '../data/invitation.repository';
import { adminNotFound, invitationNotFound } from '../domain/admin-errors';
import { AdminService } from '../services/admin.service';
import { InvitationService } from '../services/invitation.service';
import { AdminDto, InvitationDto, InviteAdminDto, SetRolesDto } from './admins.dto';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './require-permission.decorator';

const problem = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    content: { [PROBLEM_JSON]: { schema: { $ref: getSchemaPath(ProblemDetailsDto) } } },
  });

const AUTH =
  '`UNAUTHENTICATED` / `TOKEN_EXPIRED` — missing, invalid or expired access token. `PERMISSION_DENIED` (403) — you lack the permission; `ROLE_ESCALATION` (403) — only a Super Admin may grant or change access (interim rule until P2-13).';

const adminView = (admin: AdminRow): AdminDto => ({ ...admin });
const invitationView = (invitation: InvitationRow): InvitationDto => ({
  id: invitation.id,
  email: invitation.email,
  invitedBy: invitation.invitedBy,
  expiresAt: invitation.expiresAt.toISOString(),
  createdAt: invitation.createdAt.toISOString(),
  roles: invitation.roles,
});

const uuid = (notFound: () => Error) => new ParseUUIDPipe({ exceptionFactory: notFound });

/** `/v1/admin/admins…` — who is an administrator, with which roles (README §13.5). */
@ApiTags('admin: access control')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/admins')
export class AdminsController {
  constructor(
    private readonly admins: AdminService,
    private readonly invitations: InvitationService,
  ) {}

  @Get()
  @RequirePermission('admins:read')
  @ApiOkResponse({
    type: AdminDto,
    isArray: true,
    description: 'People who hold at least one role.',
  })
  @problem(403, AUTH)
  async list(): Promise<AdminDto[]> {
    return (await this.admins.list()).map(adminView);
  }

  @Post('invitations')
  @RequirePermission('admins:manage')
  @ApiCreatedResponse({ type: InvitationDto })
  @problem(403, AUTH)
  @problem(409, '`EMAIL_TAKEN` — that address already has an account: assign roles to it instead.')
  @problem(422, '`VALIDATION_FAILED` — invalid email, unknown role or drawer, or no roles.')
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Body() dto: InviteAdminDto,
  ): Promise<InvitationDto> {
    return invitationView(await this.invitations.invite({ id: user.id, ip }, dto));
  }

  @Get('invitations')
  @RequirePermission('admins:read')
  @ApiOkResponse({
    type: InvitationDto,
    isArray: true,
    description: 'Open (unused, unexpired) invitations.',
  })
  @problem(403, AUTH)
  async listInvitations(): Promise<InvitationDto[]> {
    return (await this.invitations.list()).map(invitationView);
  }

  @Delete('invitations/:id')
  @HttpCode(204)
  @RequirePermission('admins:manage')
  @ApiNoContentResponse({ description: 'Invitation revoked; its link stops working.' })
  @problem(403, AUTH)
  @problem(404, '`NOT_FOUND` — no such open invitation.')
  async revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuid(invitationNotFound)) id: string,
  ): Promise<void> {
    await this.invitations.revoke({ id: user.id, ip }, id);
  }

  @Put(':userId/roles')
  @RequirePermission('admins:manage')
  @ApiOkResponse({ type: AdminDto })
  @problem(403, AUTH)
  @problem(404, '`NOT_FOUND` — no such active user.')
  @problem(422, '`VALIDATION_FAILED` — unknown role or drawer, or invalid body.')
  async setRoles(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('userId', uuid(adminNotFound)) userId: string,
    @Body() dto: SetRolesDto,
  ): Promise<AdminDto> {
    return adminView(await this.admins.setRoles({ id: user.id, ip }, userId, dto.roles));
  }

  @Delete(':userId/mfa')
  @HttpCode(204)
  @RequirePermission('admins:manage')
  @ApiNoContentResponse({
    description:
      'Their two-step verification is removed (a lost phone). They sign in and are asked to set it up again.',
  })
  @problem(403, AUTH)
  @problem(404, '`NOT_FOUND` — no such administrator.')
  async resetMfa(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('userId', uuid(adminNotFound)) userId: string,
  ): Promise<void> {
    await this.admins.resetMfa({ id: user.id, ip }, userId);
  }

  @Delete(':userId')
  @HttpCode(204)
  @RequirePermission('admins:manage')
  @ApiNoContentResponse({
    description:
      'All admin access removed. The person stays a customer; the very next admin request is refused.',
  })
  @problem(403, AUTH)
  @problem(404, '`NOT_FOUND` — no such user.')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('userId', uuid(adminNotFound)) userId: string,
  ): Promise<void> {
    await this.admins.deactivate({ id: user.id, ip }, userId);
  }
}
