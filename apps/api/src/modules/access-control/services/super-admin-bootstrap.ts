import { type Kysely, sql } from 'kysely';
import type { Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import type { Database } from '../../../db/kysely';
import { withTransaction } from '../../../db/transaction';
import { AccountProvisioning } from '../../auth-users';
import { AuditLog } from '../../reporting-audit';

export interface BootstrapInput {
  email: string;
  name?: string | undefined;
  /** Allow creating another Super Admin although one already exists. */
  forceAdditional?: boolean | undefined;
}

export type BootstrapOutcome =
  | {
      kind: 'created' | 'promoted' | 'already';
      userId: string;
      email: string;
      /** Present only when the account has no password yet. Single use; the raw token exists nowhere else. */
      setup?: { link: string; expiresInMinutes: number };
    }
  | { kind: 'refused'; reason: 'super_admin_exists' | 'account_not_active' };

/** Serialises concurrent bootstrap runs (two terminals, a retried deploy hook). */
const LOCK_KEY = 'rento:bootstrap-super-admin';

/**
 * Creates the first Super Admin (README §13.5). Runs ONLY from the server-side CLI — no HTTP route can do this.
 *
 *  - No Super Admin yet: creates the account (or promotes the existing one) and assigns the locked role.
 *  - One exists: refuses, unless `forceAdditional`; running again for someone who already is one is a no-op.
 *  - Accounts without a password get a one-time setup link; a password is never chosen, stored or printed here.
 * Everything happens in one transaction under an advisory lock.
 * (Audit logging of this action arrives with the audit service, P2-14.)
 */
export async function bootstrapSuperAdmin(
  deps: { db: Kysely<Database>; config: AppConfig; clock: Clock },
  input: BootstrapInput,
): Promise<BootstrapOutcome> {
  const email = input.email.trim().toLowerCase();
  const provisioning = new AccountProvisioning(deps.config, deps.clock);
  const audit = new AuditLog(deps.clock);

  return withTransaction(deps.db, async (trx): Promise<BootstrapOutcome> => {
    await sql`select pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`.execute(trx);

    const role = await trx
      .selectFrom('roles')
      .select('id')
      .where('is_super_admin', '=', true)
      .executeTakeFirstOrThrow();

    const activeSuperAdmins = await trx
      .selectFrom('user_roles')
      .innerJoin('users', 'users.id', 'user_roles.user_id')
      .select((eb) => eb.fn.count<string>('user_roles.user_id').distinct().as('n'))
      .where('user_roles.role_id', '=', role.id)
      .where('users.status', '=', 'active')
      .executeTakeFirstOrThrow();

    const existing = await provisioning.findByEmail(trx, email);
    if (existing && existing.status !== 'active') {
      return { kind: 'refused', reason: 'account_not_active' };
    }

    const alreadySuperAdmin =
      existing !== undefined &&
      (await trx
        .selectFrom('user_roles')
        .select('id')
        .where('user_id', '=', existing.id)
        .where('role_id', '=', role.id)
        .executeTakeFirst()) !== undefined;

    if (!alreadySuperAdmin && Number(activeSuperAdmins.n) > 0 && !input.forceAdditional) {
      return { kind: 'refused', reason: 'super_admin_exists' };
    }

    const { user, created } = await provisioning.ensureAccount(trx, {
      email,
      name: input.name,
    });
    if (!alreadySuperAdmin) {
      await trx
        .insertInto('user_roles')
        .values({ user_id: user.id, role_id: role.id, drawer_id: null, granted_by: null })
        .execute();
    }

    const setup = (await provisioning.hasPassword(trx, user.id))
      ? undefined
      : await provisioning.issuePasswordSetupLink(trx, user.id, email);

    const kind = alreadySuperAdmin ? 'already' : created ? 'created' : 'promoted';
    if (kind !== 'already') {
      // The operator CLI has no signed-in actor: the audit row records `actor = null` (the system / the operator).
      await audit.record(trx, {
        actor: { id: null },
        action: 'super_admin.bootstrapped',
        entityType: 'user',
        entityId: user.id,
        after: { email, outcome: kind, forceAdditional: input.forceAdditional ?? false },
      });
    }
    return { kind, userId: user.id, email, ...(setup && { setup }) };
  });
}
