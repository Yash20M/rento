import { Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import type { Database } from '../../../db/kysely';

type Db = Kysely<Database>;

export interface Assignment {
  roleId: string;
  drawerId: string | null;
}

export interface AssignmentView extends Assignment {
  roleName: string;
  isSuperAdmin: boolean;
}

export interface AdminRow {
  id: string;
  email: string | null;
  displayName: string | null;
  status: string;
  roles: AssignmentView[];
}

@Injectable()
export class AdminRepository {
  /** Users that hold at least one role, with their assignments. */
  async listAdmins(db: Db): Promise<AdminRow[]> {
    const rows = await db
      .selectFrom('user_roles')
      .innerJoin('users', 'users.id', 'user_roles.user_id')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select([
        'users.id as user_id',
        'users.email',
        'users.display_name',
        'users.status',
        'roles.id as role_id',
        'roles.name as role_name',
        'roles.is_super_admin',
        'user_roles.drawer_id',
      ])
      .orderBy('users.created_at')
      .orderBy('roles.name')
      .execute();
    return this.group(rows);
  }

  async findAdmin(db: Db, userId: string): Promise<AdminRow | undefined> {
    const rows = await db
      .selectFrom('users')
      .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
      .leftJoin('roles', 'roles.id', 'user_roles.role_id')
      .select([
        'users.id as user_id',
        'users.email',
        'users.display_name',
        'users.status',
        'roles.id as role_id',
        'roles.name as role_name',
        'roles.is_super_admin',
        'user_roles.drawer_id',
      ])
      .where('users.id', '=', userId)
      .orderBy('roles.name')
      .execute();
    return this.group(rows)[0];
  }

  /** Row-locks the user so concurrent changes to one person's access queue up. */
  async lockUser(db: Db, userId: string): Promise<{ id: string; status: string } | undefined> {
    return db
      .selectFrom('users')
      .select(['id', 'status'])
      .where('id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
  }

  async replaceAssignments(
    db: Db,
    userId: string,
    assignments: readonly Assignment[],
    grantedBy: string,
  ): Promise<void> {
    await db.deleteFrom('user_roles').where('user_id', '=', userId).execute();
    if (assignments.length === 0) return;
    await db
      .insertInto('user_roles')
      .values(
        assignments.map((a) => ({
          user_id: userId,
          role_id: a.roleId,
          drawer_id: a.drawerId,
          granted_by: grantedBy,
        })),
      )
      .execute();
  }

  /** Serialises every change that could remove a Super Admin (held to the end of the transaction). */
  async lockSuperAdmins(db: Db): Promise<void> {
    await sql`select pg_advisory_xact_lock(hashtext('rento:super-admin-changes'))`.execute(db);
  }

  /** Active people holding the Super Admin role, not counting `exceptUserId`. */
  async countOtherActiveSuperAdmins(db: Db, exceptUserId: string): Promise<number> {
    const row = await db
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .innerJoin('users', 'users.id', 'user_roles.user_id')
      .select((eb) => eb.fn.count<string>('users.id').distinct().as('n'))
      .where('roles.is_super_admin', '=', true)
      .where('users.status', '=', 'active')
      .where('users.id', '<>', exceptUserId)
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  async existingRoleIds(db: Db, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await db.selectFrom('roles').select('id').where('id', 'in', ids).execute();
    return new Set(rows.map((r) => r.id));
  }

  async roleNames(db: Db, ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await db
      .selectFrom('roles')
      .select(['id', 'name'])
      .where('id', 'in', ids)
      .execute();
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async existingDrawerIds(db: Db, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await db.selectFrom('drawers').select('id').where('id', 'in', ids).execute();
    return new Set(rows.map((r) => r.id));
  }

  async displayName(db: Db, userId: string): Promise<string | null> {
    const row = await db
      .selectFrom('users')
      .select('display_name')
      .where('id', '=', userId)
      .executeTakeFirst();
    return row?.display_name ?? null;
  }

  private group(
    rows: Array<{
      user_id: string;
      email: string | null;
      display_name: string | null;
      status: string;
      role_id: string | null;
      role_name: string | null;
      is_super_admin: boolean | null;
      drawer_id: string | null;
    }>,
  ): AdminRow[] {
    const byUser = new Map<string, AdminRow>();
    for (const row of rows) {
      let admin = byUser.get(row.user_id);
      if (!admin) {
        admin = {
          id: row.user_id,
          email: row.email,
          displayName: row.display_name,
          status: row.status,
          roles: [],
        };
        byUser.set(row.user_id, admin);
      }
      if (row.role_id !== null && row.role_name !== null) {
        admin.roles.push({
          roleId: row.role_id,
          roleName: row.role_name,
          isSuperAdmin: row.is_super_admin === true,
          drawerId: row.drawer_id,
        });
      }
    }
    return [...byUser.values()];
  }
}
