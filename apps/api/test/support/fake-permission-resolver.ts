import {
  type DrawerScope,
  type EffectivePermissions,
  NO_PERMISSIONS,
  type PermissionResolver,
} from '../../src/modules/access-control/domain/authorization';

/** Test stand-in for the authorization engine: a table of what each user may do. */
export class FakePermissionResolver implements PermissionResolver {
  private readonly table = new Map<string, EffectivePermissions>();

  grant(userId: string, ...permissions: string[]): void {
    this.table.set(userId, {
      superAdmin: false,
      hasRole: true,
      permissions: new Set(permissions),
      scopes: new Map<string, DrawerScope>(permissions.map((p) => [p, 'all'])),
    });
  }

  makeSuperAdmin(userId: string): void {
    this.table.set(userId, {
      superAdmin: true,
      hasRole: true,
      permissions: new Set(),
      scopes: new Map(),
    });
  }

  async effective(userId: string): Promise<EffectivePermissions> {
    return this.table.get(userId) ?? NO_PERMISSIONS;
  }
}
