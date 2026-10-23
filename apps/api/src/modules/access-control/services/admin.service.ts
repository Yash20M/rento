import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { MfaService } from '../../auth-users';
import { type Actor, AuditLog } from '../../reporting-audit';
import { AdminRepository, type AdminRow } from '../data/admin.repository';
import { adminNotFound } from '../domain/admin-errors';
import { AssignmentChecker, type RequestedAssignment } from './assignment-checker';
import { GrantPolicy, lastSuperAdmin, selfChange } from './grant-policy';
import { PermissionAuthority } from './permission-authority';

const assignments = (admin: AdminRow | undefined) =>
  (admin?.roles ?? []).map((r) => ({
    roleId: r.roleId,
    roleName: r.roleName,
    drawerId: r.drawerId,
  }));

/**
 * Who holds which role (README §13.5). Promote a customer = give them a role; deactivate = take every role away (the
 * customer account and its sessions are untouched). Each change is audited in its own transaction and invalidates the
 * permission cache after commit, so it applies to the person's very next request. Final anti-escalation rules: P2-13.
 */
@Injectable()
export class AdminService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly admins: AdminRepository,
    private readonly checker: AssignmentChecker,
    private readonly audit: AuditLog,
    private readonly authority: PermissionAuthority,
    private readonly policy: GrantPolicy,
    private readonly mfa: MfaService,
  ) {}

  list(): Promise<AdminRow[]> {
    return this.admins.listAdmins(this.db);
  }

  /** REPLACES the user's assignments. An empty list removes all admin access. */
  async setRoles(
    actor: Actor,
    userId: string,
    requested: readonly RequestedAssignment[],
  ): Promise<AdminRow> {
    if (actor.id === userId) throw selfChange();
    const wanted = await this.checker.check(requested);
    await withTransaction(this.db, async (trx) => {
      await this.admins.lockSuperAdmins(trx);
      const user = await this.admins.lockUser(trx, userId);
      if (!user || user.status !== 'active') throw adminNotFound();
      const before = await this.admins.findAdmin(trx, userId);
      await this.guard(trx, actor, userId, before, wanted);
      await this.admins.replaceAssignments(trx, userId, wanted, actor.id as string);
      const after = await this.admins.findAdmin(trx, userId);
      await this.audit.record(trx, {
        actor,
        action: 'admin.roles_set',
        entityType: 'user',
        entityId: userId,
        before: { roles: assignments(before) },
        after: { roles: assignments(after) },
      });
    });
    this.authority.invalidateUser(userId);
    const admin = await this.admins.findAdmin(this.db, userId);
    if (!admin) throw adminNotFound();
    return admin;
  }

  /** Idempotent: removes every assignment; the person stays a customer. */
  async deactivate(actor: Actor, userId: string): Promise<void> {
    if (actor.id === userId) throw selfChange();
    await withTransaction(this.db, async (trx) => {
      await this.admins.lockSuperAdmins(trx);
      const user = await this.admins.lockUser(trx, userId);
      if (!user) throw adminNotFound();
      const before = await this.admins.findAdmin(trx, userId);
      await this.guard(trx, actor, userId, before, []);
      await this.admins.replaceAssignments(trx, userId, [], actor.id as string);
      await this.audit.record(trx, {
        actor,
        action: 'admin.deactivated',
        entityType: 'user',
        entityId: userId,
        before: { roles: assignments(before) },
        after: { roles: [] },
      });
    });
    this.authority.invalidateUser(userId);
  }

  /**
   * Removes a colleague's two-step verification (lost phone): they sign in, are asked to set it up again, and every
   * session of theirs counts as unverified. Allowed only for someone who could grant everything the colleague holds, so
   * resetting is never a way to take over a more powerful account. Audited with the change.
   */
  async resetMfa(actor: Actor, userId: string): Promise<void> {
    if (actor.id === userId) throw selfChange();
    await withTransaction(this.db, async (trx) => {
      const user = await this.admins.lockUser(trx, userId);
      if (!user) throw adminNotFound();
      const target = await this.admins.findAdmin(trx, userId);
      if (!target) throw adminNotFound();
      const held = target.roles.map((r) => ({ roleId: r.roleId, drawerId: r.drawerId }));
      await this.policy.assertCanGrant(trx, actor.id as string, held);
      const had = await this.mfa.reset(trx, userId);
      await this.audit.record(trx, {
        actor,
        action: 'admin.mfa_reset',
        entityType: 'user',
        entityId: userId,
        before: { mfaEnrolled: had },
        after: { mfaEnrolled: false },
      });
    });
  }

  /**
   * Anti-escalation (README §13.5): the actor must be able to grant everything being added AND everything being taken
   * away (so nobody can strip a superior), and the last active Super Admin cannot be removed.
   */
  private async guard(
    trx: Kysely<Database>,
    actor: Actor,
    userId: string,
    before: AdminRow | undefined,
    wanted: readonly { roleId: string; drawerId: string | null }[],
  ): Promise<void> {
    const held = (before?.roles ?? []).map((r) => ({ roleId: r.roleId, drawerId: r.drawerId }));
    await this.policy.assertCanGrant(trx, actor.id as string, [...held, ...wanted]);
    const wasSuper = (before?.roles ?? []).some((r) => r.isSuperAdmin);
    if (wasSuper && before?.status === 'active') {
      const stays = await this.stillSuperAdmin(trx, wanted);
      if (!stays && (await this.admins.countOtherActiveSuperAdmins(trx, userId)) === 0) {
        throw lastSuperAdmin();
      }
    }
  }

  private async stillSuperAdmin(
    trx: Kysely<Database>,
    wanted: readonly { roleId: string }[],
  ): Promise<boolean> {
    if (wanted.length === 0) return false;
    const row = await trx
      .selectFrom('roles')
      .select('id')
      .where(
        'id',
        'in',
        wanted.map((w) => w.roleId),
      )
      .where('is_super_admin', '=', true)
      .executeTakeFirst();
    return row !== undefined;
  }
}
