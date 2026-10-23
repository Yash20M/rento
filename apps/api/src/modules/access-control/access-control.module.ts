import { Global, Module } from '@nestjs/common';
import { AdminRepository } from './data/admin.repository';
import { InvitationRepository } from './data/invitation.repository';
import { PermissionRepository } from './data/permission.repository';
import { RoleRepository } from './data/role.repository';
import { PERMISSION_RESOLVER } from './domain/authorization';
import { AdminsController } from './http/admins.controller';
import { InvitationAcceptController } from './http/invitation-accept.controller';
import { AdminMeController } from './http/admin-me.controller';
import { PermissionGuard } from './http/permission.guard';
import { RolesController } from './http/roles.controller';
import { AccessScopes } from './services/access-scopes';
import { AdminService } from './services/admin.service';
import { AssignmentChecker } from './services/assignment-checker';
import { GrantPolicy } from './services/grant-policy';
import { DbPermissionResolver } from './services/db-permission-resolver';
import { PermissionAuthority } from './services/permission-authority';
import { InvitationService } from './services/invitation.service';
import { PermissionCatalogService } from './services/permission-catalog.service';
import { RoleService } from './services/role.service';

/**
 * Roles, permissions, administrators and the Super Admin (README §13.5).
 * P2-08 catalog · P2-09 roles + guard seam · P2-10 bootstrap CLI · P2-11 assignments + invitations ·
 * P2-12 authorization engine (cached resolver, drawer scopes, `/admin/me`).
 */
// Global: every module with admin routes needs the guard, the resolver and the drawer-scope helper.
@Global()
@Module({
  controllers: [RolesController, AdminsController, AdminMeController, InvitationAcceptController],
  providers: [
    PermissionRepository,
    PermissionCatalogService,
    RoleRepository,
    RoleService,
    AdminRepository,
    InvitationRepository,
    AssignmentChecker,
    GrantPolicy,
    AdminService,
    InvitationService,
    PermissionGuard,
    DbPermissionResolver,
    PermissionAuthority,
    AccessScopes,
    // The engine: DB resolver behind a short-TTL cache that role / assignment changes invalidate.
    { provide: PERMISSION_RESOLVER, useExisting: PermissionAuthority },
  ],
  exports: [
    PermissionCatalogService,
    PermissionGuard,
    PERMISSION_RESOLVER,
    PermissionAuthority,
    AccessScopes,
  ],
})
export class AccessControlModule {}
