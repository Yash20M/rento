import { Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../../../db/kysely';
import type { Assignment } from './admin.repository';

type Db = Kysely<Database>;

export interface InvitationRow {
  id: string;
  email: string;
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
  roles: Array<Assignment & { roleName: string }>;
}

@Injectable()
export class InvitationRepository {
  /** Supersedes any open invitation of this address (their link stops working). */
  async revokeOpenForEmail(db: Db, email: string, now: Date): Promise<void> {
    await db
      .updateTable('admin_invitations')
      .set({ revoked_at: now })
      .where('email', '=', email)
      .where('accepted_at', 'is', null)
      .where('revoked_at', 'is', null)
      .execute();
  }

  async insert(
    db: Db,
    invitation: {
      email: string;
      tokenHash: string;
      invitedBy: string;
      expiresAt: Date;
      createdAt: Date;
      roles: readonly Assignment[];
    },
  ): Promise<string> {
    const row = await db
      .insertInto('admin_invitations')
      .values({
        email: invitation.email,
        token_hash: invitation.tokenHash,
        invited_by: invitation.invitedBy,
        expires_at: invitation.expiresAt,
        created_at: invitation.createdAt,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('admin_invitation_roles')
      .values(
        invitation.roles.map((r) => ({
          invitation_id: row.id,
          role_id: r.roleId,
          drawer_id: r.drawerId,
        })),
      )
      .execute();
    return row.id;
  }

  async findById(db: Db, id: string): Promise<InvitationRow | undefined> {
    const row = await db
      .selectFrom('admin_invitations')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? (await this.withRoles(db, [row]))[0] : undefined;
  }

  /** Read-only: is this token an open, unexpired invitation? */
  async findOpenByHash(db: Db, tokenHash: string, now: Date): Promise<InvitationRow | undefined> {
    const row = await db
      .selectFrom('admin_invitations')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('accepted_at', 'is', null)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', now)
      .executeTakeFirst();
    return row ? (await this.withRoles(db, [row]))[0] : undefined;
  }

  /**
   * Atomically uses up the invitation: of any number of concurrent attempts exactly one matches the WHERE clause
   * (the others re-check it after the winner commits and match nothing).
   */
  async consume(db: Db, tokenHash: string, now: Date): Promise<InvitationRow | undefined> {
    const row = await db
      .updateTable('admin_invitations')
      .set({ accepted_at: now })
      .where('token_hash', '=', tokenHash)
      .where('accepted_at', 'is', null)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', now)
      .returningAll()
      .executeTakeFirst();
    return row ? (await this.withRoles(db, [row]))[0] : undefined;
  }

  async setAcceptedBy(db: Db, id: string, userId: string): Promise<void> {
    await db
      .updateTable('admin_invitations')
      .set({ accepted_by: userId })
      .where('id', '=', id)
      .execute();
  }

  async listOpen(db: Db, now: Date): Promise<InvitationRow[]> {
    const rows = await db
      .selectFrom('admin_invitations')
      .selectAll()
      .where('accepted_at', 'is', null)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', now)
      .orderBy('created_at', 'desc')
      .execute();
    return this.withRoles(db, rows);
  }

  /** True if an open invitation was revoked. */
  async revoke(db: Db, id: string, now: Date): Promise<boolean> {
    const result = await db
      .updateTable('admin_invitations')
      .set({ revoked_at: now })
      .where('id', '=', id)
      .where('accepted_at', 'is', null)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) > 0;
  }

  private async withRoles(
    db: Db,
    rows: Array<{
      id: string;
      email: string;
      invited_by: string;
      expires_at: Date;
      created_at: Date;
    }>,
  ): Promise<InvitationRow[]> {
    if (rows.length === 0) return [];
    const roleRows = await db
      .selectFrom('admin_invitation_roles')
      .innerJoin('roles', 'roles.id', 'admin_invitation_roles.role_id')
      .select([
        'admin_invitation_roles.invitation_id',
        'admin_invitation_roles.role_id',
        'admin_invitation_roles.drawer_id',
        'roles.name as role_name',
      ])
      .where(
        'admin_invitation_roles.invitation_id',
        'in',
        rows.map((r) => r.id),
      )
      .orderBy('roles.name')
      .execute();
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      invitedBy: row.invited_by,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      roles: roleRows
        .filter((r) => r.invitation_id === row.id)
        .map((r) => ({ roleId: r.role_id, drawerId: r.drawer_id, roleName: r.role_name })),
    }));
  }
}
