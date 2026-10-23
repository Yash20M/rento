import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { AppError } from '../../common/errors/app-error';
import type { Database } from '../../db/kysely';
import { KYSELY } from '../../db/tokens';
import type { AuditEntryDto, AuditPageDto, AuditQuery } from './http/audit.dto';

const DEFAULT_LIMIT = 25;

interface Row {
  id: string;
  at: Date;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  ip: string | null;
  before: unknown;
  after: unknown;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
}

const badField = (field: string, message: string): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field, message }],
  });

const encode = (at: Date, id: string): string =>
  Buffer.from(`${at.toISOString()}|${id}`).toString('base64url');
function decode(value: string): { at: string; id: string } | undefined {
  const [at, id, ...rest] = Buffer.from(value, 'base64url').toString().split('|');
  if (!at || !id || rest.length > 0 || Number.isNaN(Date.parse(at))) return undefined;
  return /^[0-9a-f-]{36}$/.test(id) ? { at, id } : undefined;
}

/** Reads the append-only audit trail (README §8.2, §15). Secrets were redacted when the rows were written. */
@Injectable()
export class AuditQueryService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async list(query: AuditQuery): Promise<AuditPageDto> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const cursor = query.cursor === undefined ? undefined : decode(query.cursor);
    if (query.cursor !== undefined && !cursor) throw badField('cursor', 'is not valid');

    // `booking.` matches every booking action; `booking.cancelled` matches exactly that one.
    const action =
      query.action === undefined
        ? undefined
        : query.action.endsWith('.')
          ? { like: `${query.action}%` }
          : { exact: query.action };

    const result = await sql<Row>`
      SELECT a.id, a.at, a.action, a.entity_type, a.entity_id, a.reason, a.ip, a.before, a.after,
             a.actor_id, u.email::text AS actor_email, u.display_name AS actor_name
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.actor_id
       WHERE true
         ${query.entityType ? sql`AND a.entity_type = ${query.entityType}` : sql``}
         ${query.entityId ? sql`AND a.entity_id = ${query.entityId}` : sql``}
         ${query.actorId ? sql`AND a.actor_id = ${query.actorId}` : sql``}
         ${action?.exact ? sql`AND a.action = ${action.exact}` : sql``}
         ${action?.like ? sql`AND a.action LIKE ${action.like}` : sql``}
         ${query.from ? sql`AND a.at >= ${new Date(query.from)}` : sql``}
         ${query.to ? sql`AND a.at < ${new Date(query.to)}` : sql``}
         ${cursor ? sql`AND (a.at, a.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)` : sql``}
       ORDER BY a.at DESC, a.id DESC
       LIMIT ${limit + 1}`.execute(this.db);

    const page = result.rows.slice(0, limit);
    const last = page[page.length - 1];
    const items: AuditEntryDto[] = page.map((row) => ({
      id: row.id,
      at: row.at.toISOString(),
      actor: row.actor_id
        ? { id: row.actor_id, email: row.actor_email, name: row.actor_name }
        : null,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      reason: row.reason,
      before: row.before,
      after: row.after,
      ip: row.ip,
    }));
    return {
      items,
      nextCursor: result.rows.length > limit && last ? encode(last.at, last.id) : null,
    };
  }
}
