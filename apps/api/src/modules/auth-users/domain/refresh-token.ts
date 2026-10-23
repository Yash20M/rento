import { createHash, randomBytes } from 'node:crypto';

/** 256 random bits, base64url (43 chars). Opaque to clients; only its hash is stored. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 (hex). A fast hash is correct here: the input already has 256 bits of entropy, so there is nothing
 * to brute-force, and lookups by hash stay O(1) with a unique index.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
