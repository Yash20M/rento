import { Injectable } from '@nestjs/common';
import { type Kysely, type Selectable, sql } from 'kysely';
import type { Roles } from '../../../db/generated/database';
import type { Database } from '../../../db/kysely';

type Db = Kysely<Database>;
export type RoleRow = Selectable<Roles>;

export interface RoleWithPermissions extends RoleRow {
  permissions: string[];
  assignedCount: number;
}

@Injectable()
export class RoleRepository {
  async list(db: Db): Promise<RoleWithPermissions[]> {
    const roles = await db
      .selectFrom('roles')
      .selectAll()
      .orderBy('is_system', 'desc')
      .orderBy(sql`lower(name)`)
      .execute();
    return this.withDetails(db, roles);
  }

  async find(db: Db, id: string): Promise<RoleWithPermissions | undefined> {
    const role = await db.selectFrom('roles').selectAll().where('id', '=', id).executeTakeFirst();
    return role ? (await this.withDetails(db, [role]))[0] : undefined;
  }

  /** Row-locks the role so concurrent edits and deletes of it queue up. */
  async lock(db: Db, id: string): Promise<RoleRow | undefined> {
    return db.selectFrom('roles').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
  }

  async insert(db: Db, role: { name: string; description: string | null }): Promise<RoleRow> {
    return db
      .insertInto('roles')
      .values({ name: role.name, description: role.description })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    db: Db,
    id: string,
    changes: { name?: string; description?: string | null },
  ): Promise<void> {
    await db
      .updateTable('roles')
      .set({
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.description !== undefined && { description: changes.description }),
        updated_at: sql<Date>`now()`,
      })
      .where('id', '=', id)
      .execute();
  }

  async remove(db: Db, id: string): Promise<void> {
    await db.deleteFrom('roles').where('id', '=', id).execute();
  }

  /** Replaces the role's permission set. */
  async replacePermissions(db: Db, id: string, keys: readonly string[]): Promise<void> {
    await db.deleteFrom('role_permissions').where('role_id', '=', id).execute();
    if (keys.length === 0) return;
    await db
      .insertInto('role_permissions')
      .values(keys.map((permission_key) => ({ role_id: id, permission_key })))
      .execute();
  }

  /** Open invitations (not used, not revoked, not expired at `now`) that would grant this role. */
  async openInvitationCount(db: Db, id: string, now: Date): Promise<number> {
    const row = await db
      .selectFrom('admin_invitation_roles')
      .innerJoin(
        'admin_invitations',
        'admin_invitations.id',
        'admin_invitation_roles.invitation_id',
      )
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('admin_invitation_roles.role_id', '=', id)
      .where('admin_invitations.accepted_at', 'is', null)
      .where('admin_invitations.revoked_at', 'is', null)
      .where('admin_invitations.expires_at', '>', now)
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  async assignmentCount(db: Db, id: string): Promise<number> {
    const row = await db
      .selectFrom('user_roles')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('role_id', '=', id)
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  async knownPermissionKeys(db: Db, keys: readonly string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const rows = await db
      .selectFrom('permissions')
      .select('key')
      .where('key', 'in', keys)
      .execute();
    return new Set(rows.map((row) => row.key));
  }

  private async withDetails(db: Db, roles: RoleRow[]): Promise<RoleWithPermissions[]> {
    if (roles.length === 0) return [];
    const ids = roles.map((role) => role.id);
    const permissionRows = await db
      .selectFrom('role_permissions')
      .select(['role_id', 'permission_key'])
      .where('role_id', 'in', ids)
      .orderBy('permission_key')
      .execute();
    const countRows = await db
      .selectFrom('user_roles')
      .select(['role_id', (eb) => eb.fn.count<string>('user_id').distinct().as('n')])
      .where('role_id', 'in', ids)
      .groupBy('role_id')
      .execute();

    const permissions = new Map<string, string[]>();
    for (const row of permissionRows) {
      const list = permissions.get(row.role_id) ?? [];
      list.push(row.permission_key);
      permissions.set(row.role_id, list);
    }
    const counts = new Map(countRows.map((row) => [row.role_id, Number(row.n)]));
    return roles.map((role) => ({
      ...role,
      permissions: permissions.get(role.id) ?? [],
      assignedCount: counts.get(role.id) ?? 0,
    }));
  }
}
