import { AppError } from '../common/errors/app-error';

/** The booking ledger's exclusion constraint (migration 0001). */
export const OCCUPANCY_CONSTRAINT = 'no_overlapping_occupancy';

/** Lost the race for a slot: `23P01` on `no_overlapping_occupancy` → 409 BOOKING_SLOT_TAKEN. */
export class SlotTakenError extends AppError {
  constructor() {
    super({
      status: 409,
      code: 'BOOKING_SLOT_TAKEN',
      detail: 'The requested slot is no longer available',
    });
    this.name = 'SlotTakenError';
  }
}

/** Lock wait or statement timeout → 503 RETRY_LATER (retryable). */
export class RetryLaterError extends AppError {
  constructor() {
    super({ status: 503, code: 'RETRY_LATER', detail: 'Please retry shortly' });
    this.name = 'RetryLaterError';
  }
}

/**
 * A unique constraint was violated. Deliberately NOT an `AppError`: which API error it means depends on
 * the constraint, so the owning service translates it. If nobody does, it surfaces as a 500.
 */
export class UniqueViolationError extends Error {
  constructor(
    readonly constraint: string | undefined,
    readonly table: string | undefined,
  ) {
    super(`Unique constraint violated: ${constraint ?? 'unknown'}`);
    this.name = 'UniqueViolationError';
  }
}

interface PgErrorFields {
  code: string;
  constraint?: string;
  table?: string;
}

function isPgError(error: unknown): error is PgErrorFields {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/** SQLSTATE of a driver error, or `undefined` for anything else. */
export function pgErrorCode(error: unknown): string | undefined {
  return isPgError(error) ? error.code : undefined;
}

/**
 * Translates well-known PostgreSQL failures into domain errors (README §9.4). Anything it does not
 * recognise is returned unchanged (same reference) so no information is lost.
 */
export function mapDbError(error: unknown): unknown {
  if (!isPgError(error)) return error;

  switch (error.code) {
    case '23P01':
      return error.constraint === OCCUPANCY_CONSTRAINT ? new SlotTakenError() : error;
    case '23505':
      return new UniqueViolationError(error.constraint, error.table);
    case '55P03': // lock_not_available
    case '57014': // query_canceled (statement_timeout)
      return new RetryLaterError();
    default:
      return error;
  }
}
