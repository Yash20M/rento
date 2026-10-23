import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
} from '../../src/modules/auth-users/domain/refresh-token';

describe('refresh token primitives', () => {
  it('U-16a generates 256-bit base64url tokens that never repeat', () => {
    const tokens = Array.from({ length: 200 }, () => generateRefreshToken());
    for (const token of tokens) {
      expect(token).toHaveLength(43);
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
    expect(new Set(tokens).size).toBe(200);
  });

  it('U-16b hashes with SHA-256 (hex), deterministically, and never equals the token', () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hashRefreshToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
    expect(hashRefreshToken(generateRefreshToken())).not.toBe(hash);
  });
});
