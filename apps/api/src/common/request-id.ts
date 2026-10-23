import { randomUUID } from 'node:crypto';

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

/** Keeps a well-formed inbound `X-Request-Id`, otherwise generates one. Never trusts arbitrary input. */
export function resolveRequestId(
  header: string | string[] | undefined,
  generate: () => string = randomUUID,
): string {
  return typeof header === 'string' && VALID_REQUEST_ID.test(header) ? header : generate();
}
