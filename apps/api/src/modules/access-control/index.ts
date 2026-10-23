// Public surface of the access-control module (README §12.3): other modules import from here, never from internals.
export { AccessControlModule } from './access-control.module';
export {
  PERMISSIONS,
  PERMISSION_KEY_PATTERN,
  type PermissionDefinition,
  type PermissionKey,
  isPermissionKey,
  permissionsByGroup,
} from './domain/permissions';
export { PermissionCatalogService } from './services/permission-catalog.service';
export {
  type DrawerAccess,
  type DrawerScope,
  type EffectivePermissions,
  accessIncludes,
  canAccessDrawer,
  drawerAccess,
  holds,
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from './domain/authorization';
export { AccessScopes } from './services/access-scopes';
export { PermissionGuard } from './http/permission.guard';
export { REQUIRED_PERMISSION, RequirePermission } from './http/require-permission.decorator';
export { SuperAdminOnly } from './http/super-admin-only.decorator';
