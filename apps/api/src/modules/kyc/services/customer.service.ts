import { Inject, Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import { AppError } from '../../../common/errors/app-error';
import { mediaRef } from '../../../common/media/images';
import type { Database } from '../../../db/kysely';
import { withTransaction } from '../../../db/transaction';
import { type Actor, AuditLog } from '../../reporting-audit';
import { KYSELY } from '../../../db/tokens';
import { maskAadhaar } from '../domain/aadhaar';
import type {
  CustomerDetailDto,
  CustomerDto,
  CustomerPageDto,
  CustomersQuery,
} from '../http/kyc.dto';
import { kycView } from '../http/kyc-view';
import { KycService } from './kyc.service';

interface Row {
  id: string;
  email: string | null;
  name: string | null;
  created_at: Date;
  kyc_status: string;
  last4: string | null;
  bookings: string;
  status: string;
  avatar_id: string | null;
  email_verified: boolean;
}

const notFound = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'Customer not found' });

const encode = (at: Date, id: string): string =>
  Buffer.from(`${at.toISOString()}|${id}`).toString('base64url');
function decode(value: string): { at: string; id: string } | undefined {
  const [at, id, ...rest] = Buffer.from(value, 'base64url').toString().split('|');
  if (!at || !id || rest.length > 0 || Number.isNaN(Date.parse(at))) return undefined;
  return /^[0-9a-f-]{36}$/.test(id) ? { at, id } : undefined;
}

/** Staff view of the people who use Rento, with their identity-verification state. */
@Injectable()
export class CustomerService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly kyc: KycService,
    private readonly audit: AuditLog,
  ) {}

  /**
   * Suspends or reinstates a customer. Suspending ends every sign-in at once (refresh tokens revoked) and blocks new
   * bookings; bookings already made stay as they are for staff to handle. Staff accounts cannot be suspended here.
   */
  async setStatus(
    actor: Actor,
    id: string,
    status: 'active' | 'suspended',
    reason: string,
  ): Promise<CustomerDetailDto> {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw notFound();
    await withTransaction(this.db, async (trx) => {
      const found = await sql<{ status: string; staff: boolean }>`
        SELECT u.status, EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id) AS staff
          FROM users u WHERE u.id = ${id} AND u.status <> 'deleted' FOR UPDATE`.execute(trx);
      const row = found.rows[0];
      if (!row) throw notFound();
      if (row.staff) {
        throw new AppError({
          status: 409,
          code: 'INVALID_STATE',
          detail: 'This person is a staff member. Manage them under Staff',
        });
      }
      if (row.status === status) return; // already so
      await sql`UPDATE users SET status = ${status}, updated_at = now() WHERE id = ${id}`.execute(
        trx,
      );
      if (status === 'suspended') {
        await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${id} AND revoked_at IS NULL`.execute(
          trx,
        );
      }
      await this.audit.record(trx, {
        actor,
        action: status === 'suspended' ? 'customer.suspended' : 'customer.reinstated',
        entityType: 'user',
        entityId: id,
        before: { status: row.status },
        after: { status },
        reason,
      });
    });
    return this.get(id);
  }

  async list(query: CustomersQuery): Promise<CustomerPageDto> {
    const limit = query.limit ?? 25;
    const cursor = query.cursor === undefined ? undefined : decode(query.cursor);
    if (query.cursor !== undefined && !cursor) {
      throw new AppError({
        status: 422,
        code: 'VALIDATION_FAILED',
        detail: 'Request validation failed',
        errors: [{ field: 'cursor', message: 'is not valid' }],
      });
    }
    const like = query.q ? `%${query.q.replace(/[\\%_]/g, '\\$&')}%` : undefined;
    const status = query.kyc;
    const result = await sql<Row>`
      SELECT * FROM (
        SELECT u.id, u.email::text AS email, u.display_name AS name, u.created_at, u.status,
               u.avatar_media_id AS avatar_id, (u.email_verified_at IS NOT NULL) AS email_verified,
               COALESCE(k.status, CASE WHEN EXISTS (
                 SELECT 1 FROM kyc_requests r WHERE r.user_id = u.id AND r.completed_at IS NULL AND r.expires_at > now())
                 THEN 'pending' ELSE 'none' END) AS kyc_status,
               k.aadhaar_last4 AS last4,
               (SELECT count(*) FROM bookings b WHERE b.user_id = u.id) AS bookings
          FROM users u LEFT JOIN user_kyc k ON k.user_id = u.id
         WHERE u.status <> 'deleted'
           ${like ? sql`AND (u.email::text ILIKE ${like} OR u.display_name ILIKE ${like})` : sql``}
           ${cursor ? sql`AND (u.created_at, u.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)` : sql``}
      ) c
       ${status ? sql`WHERE c.kyc_status = ${status}` : sql``}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ${limit + 1}`.execute(this.db);
    const page = result.rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map(this.view),
      nextCursor: result.rows.length > limit && last ? encode(last.created_at, last.id) : null,
    };
  }

  async get(id: string): Promise<CustomerDetailDto> {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw notFound();
    const result = await sql<Row>`
      SELECT u.id, u.email::text AS email, u.display_name AS name, u.created_at, u.status,
             u.avatar_media_id AS avatar_id, (u.email_verified_at IS NOT NULL) AS email_verified,
             'none' AS kyc_status, NULL AS last4,
             (SELECT count(*) FROM bookings b WHERE b.user_id = u.id) AS bookings
        FROM users u WHERE u.id = ${id} AND u.status <> 'deleted'`.execute(this.db);
    const row = result.rows[0];
    if (!row) throw notFound();
    const kyc = await this.kyc.status(id);
    const active = await sql<{ n: string }>`
      SELECT count(*) AS n FROM bookings WHERE user_id = ${id} AND status IN ('held','confirmed','active','overdue')`.execute(
      this.db,
    );
    return {
      ...this.view({ ...row, kyc_status: kyc.status, last4: kyc.maskedAadhaar?.slice(-4) ?? null }),
      kyc: kycView(kyc),
      activeBookings: Number(active.rows[0]?.n ?? 0),
    };
  }

  private view = (row: Row): CustomerDto => ({
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    kycStatus: row.kyc_status,
    maskedAadhaar: row.last4 ? maskAadhaar(row.last4) : null,
    bookingCount: Number(row.bookings),
    accountStatus: row.status,
    avatarUrl: row.avatar_id ? mediaRef(row.avatar_id) : null,
    emailVerified: row.email_verified,
  });
}
