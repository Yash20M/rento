import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import type {
  DrawerScope,
  EffectivePermissions,
  PermissionResolver,
} from '../domain/authorization';

/**
 * Effective permissions straight from the database on every call (README §13.5): the union of the permissions of all
 * roles the user holds, each with its drawer scope; any Super Admin role makes the user a Super Admin. A suspended or
 * deleted user has none. Wrapped by `PermissionAuthority`, which adds the short-TTL cache.
 */
@Injectable()
export class DbPermissionResolver implements PermissionResolver {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async effective(userId: string): Promise<EffectivePermissions> {
    const rows = await this.db
      .selectFrom('user_roles')
      .innerJoin('users', 'users.id', 'user_roles.user_id')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .leftJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
      .select(['roles.is_super_admin', 'role_permissions.permission_key', 'user_roles.drawer_id'])
      .where('user_roles.user_id', '=', userId)
      .where('users.status', '=', 'active')
      .execute();

    const permissions = new Set<string>();
    const scopes = new Map<string, DrawerScope>();
    for (const row of rows) {
      if (row.permission_key === null) continue;
      permissions.add(row.permission_key);
      const current = scopes.get(row.permission_key);
      if (row.drawer_id === null || current === 'all') {
        scopes.set(row.permission_key, 'all');
      } else {
        const ids = new Set(current ?? []);
        ids.add(row.drawer_id);
        scopes.set(row.permission_key, ids);
      }
    }
    return {
      superAdmin: rows.some((row) => row.is_super_admin),
      hasRole: rows.length > 0,
      permissions,
      scopes,
    };
  }
}
