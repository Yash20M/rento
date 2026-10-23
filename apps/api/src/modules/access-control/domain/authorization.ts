/** `'all'` = every drawer; otherwise only these drawers. */
export type DrawerScope = 'all' | ReadonlySet<string>;

/** What a user may do in the admin API (README §13.5). Computed server-side per request, never baked into the JWT. */
export interface EffectivePermissions {
  /** The Super Admin role bypasses permission lookup: it holds every permission, including future ones. */
  superAdmin: boolean;
  /** True when the user holds at least one role (Super Admin or not): they may open the admin panel. */
  hasRole: boolean;
  /** Union of the permissions of every role the user holds (empty for a Super Admin: it is implicit). */
  permissions: ReadonlySet<string>;
  /** Per permission, the drawers it applies to. A permission held by any role without a drawer limit is `'all'`. */
  scopes: ReadonlyMap<string, DrawerScope>;
}

/** Port used by the permission guard. Implemented by `PermissionAuthority` (cache over the database resolver). */
export interface PermissionResolver {
  effective(userId: string): Promise<EffectivePermissions>;
}

export const PERMISSION_RESOLVER = Symbol('PERMISSION_RESOLVER');

/** Does the user hold the permission at all (in any drawer scope)? */
export const holds = (effective: EffectivePermissions, permission: string): boolean =>
  effective.superAdmin || effective.permissions.has(permission);

export type DrawerAccess = { kind: 'all' } | { kind: 'drawers'; ids: string[] } | { kind: 'none' };

/** Which drawers a query for this permission may touch — the filter helper for scoped lists and mutations. */
export function drawerAccess(effective: EffectivePermissions, permission: string): DrawerAccess {
  if (effective.superAdmin) return { kind: 'all' };
  const scope = effective.scopes.get(permission);
  if (scope === undefined) return { kind: 'none' };
  if (scope === 'all') return { kind: 'all' };
  return { kind: 'drawers', ids: [...scope].sort() };
}

/** Does an already computed access level include this drawer? */
export const accessIncludes = (access: DrawerAccess, drawerId: string): boolean =>
  access.kind === 'all' || (access.kind === 'drawers' && access.ids.includes(drawerId));

/** `can(user, 'bookings:cancel', { drawerId })` from README §13.5. */
export function canAccessDrawer(
  effective: EffectivePermissions,
  permission: string,
  drawerId: string,
): boolean {
  const access = drawerAccess(effective, permission);
  return access.kind === 'all' || (access.kind === 'drawers' && access.ids.includes(drawerId));
}

export const NO_PERMISSIONS: EffectivePermissions = {
  superAdmin: false,
  hasRole: false,
  permissions: new Set(),
  scopes: new Map(),
};
