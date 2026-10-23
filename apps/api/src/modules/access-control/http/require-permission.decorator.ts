import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../domain/permissions';

export const REQUIRED_PERMISSION = 'rento:required-permission';
export const ADMIN_ACCESS = 'rento:admin-access';

/**
 * Declares the permission a route needs (README §13.5). Every `/v1/admin/*` route must carry it (or
 * `@RequireAdminAccess`); `PermissionGuard` denies routes that do not (deny by default) and a test enumerates all routes.
 * Typed against the catalog so a typo does not compile.
 */
export const RequirePermission = (permission: PermissionKey) =>
  SetMetadata(REQUIRED_PERMISSION, permission);

/** For routes every administrator needs whatever their role (for example `GET /v1/admin/me`): any role holder passes. */
export const RequireAdminAccess = () => SetMetadata(ADMIN_ACCESS, true);
