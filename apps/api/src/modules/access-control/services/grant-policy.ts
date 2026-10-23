import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { AppError } from '../../../common/errors/app-error';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import type { Assignment } from '../data/admin.repository';
import type { EffectivePermissions } from '../domain/authorization';
import { PermissionAuthority } from './permission-authority';

export interface RoleFacts {
  isSuperAdmin: boolean;
  permissions: readonly string[];
}

const escalation = (detail: string): AppError =>
  new AppError({ status: 403, code: 'ROLE_ESCALATION', detail });

/**
 * May `actor` hand out this role in this drawer scope? (README §13.5) Only a Super Admin hands out Super Admin; anyone
 * else may grant only what they hold themselves, and only where they hold it: a global grant needs the permission
 * everywhere, a drawer-limited grant needs it for that drawer.
 */
export function canGrant(
  actor: EffectivePermissions,
  role: RoleFacts,
  drawerId: string | null,
): boolean {
  if (actor.superAdmin) return true;
  if (role.isSuperAdmin) return false;
  return role.permissions.every((permission) => {
    if (!actor.permissions.has(permission)) return false;
    const scope = actor.scopes.get(permission);
    if (scope === 'all') return true;
    return drawerId !== null && scope !== undefined && scope.has(drawerId);
  });
}

/** The anti-escalation rules shared by promotions and invitations. */
@Injectable()
export class GrantPolicy {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly authority: PermissionAuthority,
  ) {}

  /** Throws `ROLE_ESCALATION` unless the actor may hand out (or take away) every one of these assignments. */
  async assertCanGrant(
    db: Kysely<Database>,
    actorId: string,
    assignments: readonly Assignment[],
  ): Promise<void> {
    const actor = await this.authority.effective(actorId);
    if (actor.superAdmin || assignments.length === 0) return;
    const facts = await this.roleFacts(
      db,
      assignments.map((a) => a.roleId),
    );
    for (const a of assignments) {
      const role = facts.get(a.roleId);
      if (!role || !canGrant(actor, role, a.drawerId)) {
        throw escalation(
          role?.isSuperAdmin
            ? 'Only a Super Admin can grant or remove the Super Admin role'
            : 'You can only grant or remove roles made of permissions you hold yourself',
        );
      }
    }
  }

  private async roleFacts(
    db: Kysely<Database>,
    roleIds: readonly string[],
  ): Promise<Map<string, RoleFacts>> {
    const ids = [...new Set(roleIds)];
    const roles = await db
      .selectFrom('roles')
      .select(['id', 'is_super_admin'])
      .where('id', 'in', ids)
      .execute();
    const permissions = await db
      .selectFrom('role_permissions')
      .select(['role_id', 'permission_key'])
      .where('role_id', 'in', ids)
      .execute();
    return new Map(
      roles.map((r) => [
        r.id,
        {
          isSuperAdmin: r.is_super_admin,
          permissions: permissions.filter((p) => p.role_id === r.id).map((p) => p.permission_key),
        },
      ]),
    );
  }
}

export const selfChange = (): AppError => escalation('You cannot change your own roles');

export const lastSuperAdmin = (): AppError =>
  new AppError({
    status: 409,
    code: 'LAST_SUPER_ADMIN',
    detail: 'The last active Super Admin cannot be removed',
  });
