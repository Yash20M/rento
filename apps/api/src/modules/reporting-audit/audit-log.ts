import type { Kysely } from 'kysely';
import type { Clock } from '../../common/clock/clock';
import type { Database } from '../../db/kysely';
import { redact } from './redact';

/** Who acted. `id: null` = the system or the operator CLI. */
export interface Actor {
  id: string | null;
  ip?: string | undefined;
}

export interface AuditEntry {
  actor: Actor;
  /** `entity.verb`, lower case with underscores: `role.updated`, `admin.roles_set`. */
  action: string;
  entityType: string;
  entityId?: string | undefined;
  before?: unknown;
  after?: unknown;
  /** Required by policy for admin actions that affect customers (README §13.3). */
  reason?: string | undefined;
}

/**
 * Writes the audit trail (README §8.2, BR-13). Always pass the CALLER'S TRANSACTION as `db`: the row then commits or
 * rolls back together with the change it describes. Plain class (no Nest decorators) so the operator CLI can use it.
 */
export class AuditLog {
  constructor(private readonly clock: Clock) {}

  async record(db: Kysely<Database>, entry: AuditEntry): Promise<void> {
    await db
      .insertInto('audit_logs')
      .values({
        actor_id: entry.actor.id,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        before: entry.before === undefined ? null : JSON.stringify(redact(entry.before)),
        after: entry.after === undefined ? null : JSON.stringify(redact(entry.after)),
        reason: entry.reason ?? null,
        ip: entry.actor.ip ?? null,
        at: this.clock.now(),
      })
      .execute();
  }
}
