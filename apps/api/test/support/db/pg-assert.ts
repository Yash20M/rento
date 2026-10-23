import { expect } from 'vitest';

interface PgErrorLike {
  code?: string;
  constraint?: string;
}

/**
 * Asserts that a query rejects with the given SQLSTATE (and constraint name when provided).
 * Returns the error for further checks.
 */
export async function expectPgError(
  promise: Promise<unknown>,
  expected: { code: string; constraint?: string },
): Promise<PgErrorLike> {
  let caught: PgErrorLike | undefined;
  try {
    await promise;
  } catch (error) {
    caught = error as PgErrorLike;
  }
  expect(caught, 'expected the statement to be rejected by the database').toBeDefined();
  expect(caught?.code).toBe(expected.code);
  if (expected.constraint !== undefined) expect(caught?.constraint).toBe(expected.constraint);
  return caught as PgErrorLike;
}
