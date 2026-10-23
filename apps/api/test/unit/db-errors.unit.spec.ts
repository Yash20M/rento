import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/common/errors/app-error';
import {
  RetryLaterError,
  SlotTakenError,
  UniqueViolationError,
  mapDbError,
  pgErrorCode,
} from '../../src/db/errors';

const pgError = (fields: Record<string, string>) => Object.assign(new Error('pg'), fields);

describe('mapDbError', () => {
  it('U-04 23P01 on no_overlapping_occupancy → SlotTakenError (409 BOOKING_SLOT_TAKEN)', () => {
    const mapped = mapDbError(pgError({ code: '23P01', constraint: 'no_overlapping_occupancy' }));
    expect(mapped).toBeInstanceOf(SlotTakenError);
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped).toMatchObject({ status: 409, code: 'BOOKING_SLOT_TAKEN' });
  });

  it('U-05 23P01 on any other constraint is returned untouched', () => {
    const error = pgError({ code: '23P01', constraint: 'some_other_exclusion' });
    expect(mapDbError(error)).toBe(error);
  });

  it('U-06 23505 → UniqueViolationError carrying constraint and table; not an AppError', () => {
    const mapped = mapDbError(
      pgError({ code: '23505', constraint: 'assets_asset_code_key', table: 'assets' }),
    );
    expect(mapped).toBeInstanceOf(UniqueViolationError);
    expect(mapped).not.toBeInstanceOf(AppError);
    expect(mapped).toMatchObject({ constraint: 'assets_asset_code_key', table: 'assets' });
  });

  it.each(['55P03', '57014'])('U-07 %s → RetryLaterError (503 RETRY_LATER)', (code) => {
    const mapped = mapDbError(pgError({ code }));
    expect(mapped).toBeInstanceOf(RetryLaterError);
    expect(mapped).toMatchObject({ status: 503, code: 'RETRY_LATER' });
  });

  it('U-08 other database and plain errors keep their identity', () => {
    const fk = pgError({ code: '23503' });
    const plain = new Error('x');
    expect(mapDbError(fk)).toBe(fk);
    expect(mapDbError(plain)).toBe(plain);
  });

  it.each([null, undefined, 'boom', 42])('U-09 non-error value %j passes through', (value) => {
    expect(mapDbError(value)).toBe(value);
  });

  it('U-10 pgErrorCode reads the SQLSTATE or returns undefined', () => {
    expect(pgErrorCode(pgError({ code: '23P01' }))).toBe('23P01');
    expect(pgErrorCode(new Error('x'))).toBeUndefined();
    expect(pgErrorCode(null)).toBeUndefined();
    expect(pgErrorCode({ code: 42 })).toBeUndefined();
  });
});
