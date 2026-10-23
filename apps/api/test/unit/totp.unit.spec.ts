import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  codeFor,
  decryptSecret,
  encryptSecret,
  hashRecoveryCode,
  matchingStep,
  newRecoveryCode,
  normalizeRecoveryCode,
  otpauthUri,
  stepOf,
} from '../../src/modules/auth-users/domain/totp';

// RFC 6238 appendix B: the shared secret is the ASCII string 12345678901234567890
const RFC_SECRET = Buffer.from('12345678901234567890');
const KEY = 'a-key-that-is-long-enough-0123456789';

describe('TOTP (RFC 6238)', () => {
  it('T-1 reproduces the RFC test vectors (last six digits of the published 8-digit codes)', () => {
    expect(codeFor(RFC_SECRET, stepOf(new Date(59_000)))).toBe('287082');
    expect(codeFor(RFC_SECRET, stepOf(new Date(1_111_111_109_000)))).toBe('081804');
    expect(codeFor(RFC_SECRET, stepOf(new Date(1_234_567_890_000)))).toBe('005924');
    expect(codeFor(RFC_SECRET, stepOf(new Date(2_000_000_000_000)))).toBe('279037');
  });

  it('T-2 accepts the current step and one step of drift either way, nothing further', () => {
    const now = new Date(1_234_567_890_000);
    const step = stepOf(now);
    for (const offset of [-1, 0, 1]) {
      expect(matchingStep(RFC_SECRET, codeFor(RFC_SECRET, step + offset), now, null)).toBe(
        step + offset,
      );
    }
    expect(matchingStep(RFC_SECRET, codeFor(RFC_SECRET, step + 2), now, null)).toBeUndefined();
    expect(matchingStep(RFC_SECRET, codeFor(RFC_SECRET, step - 2), now, null)).toBeUndefined();
  });

  it('T-3 a code is never accepted twice, nor an older one after a newer one was used', () => {
    const now = new Date(1_234_567_890_000);
    const step = stepOf(now);
    const code = codeFor(RFC_SECRET, step);
    expect(matchingStep(RFC_SECRET, code, now, step - 1)).toBe(step);
    expect(matchingStep(RFC_SECRET, code, now, step)).toBeUndefined();
    expect(matchingStep(RFC_SECRET, codeFor(RFC_SECRET, step - 1), now, step)).toBeUndefined();
  });

  it('T-4 refuses anything that is not six digits', () => {
    const now = new Date(1_234_567_890_000);
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 456', '00592 ']) {
      expect(matchingStep(RFC_SECRET, bad, now, null)).toBeUndefined();
    }
  });

  it('T-5 base32 round-trips and the otpauth address carries the secret, issuer and account', () => {
    expect(base32Encode(RFC_SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode('gezd gnbv-GY3TQOJQGEZDGNBVGY3TQOJQ').equals(RFC_SECRET)).toBe(true);
    expect(otpauthUri('Rento', 'owner@rento.demo', RFC_SECRET)).toBe(
      'otpauth://totp/Rento:owner%40rento.demo?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Rento&algorithm=SHA1&digits=6&period=30',
    );
  });

  it('T-6 recovery codes look like XXXXX-XXXXX, are typed forgivingly, and hash the same either way', () => {
    const code = newRecoveryCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(normalizeRecoveryCode(code.toLowerCase().replace('-', ' '))).toBe(code.replace('-', ''));
    expect(hashRecoveryCode(code)).toBe(hashRecoveryCode(code.toLowerCase().replace('-', '')));
    expect(hashRecoveryCode(code)).not.toBe(hashRecoveryCode(newRecoveryCode()));
  });

  it('T-7 the stored secret is encrypted, decrypts with the right key only, and is tamper-evident', () => {
    const stored = encryptSecret(RFC_SECRET, KEY);
    expect(stored).not.toContain(RFC_SECRET.toString('base64url'));
    expect(decryptSecret(stored, KEY).equals(RFC_SECRET)).toBe(true);
    expect(() => decryptSecret(stored, 'another-key-that-is-long-enough-012345')).toThrow();
    const [iv, tag, body] = stored.split('.');
    const flipped = Buffer.from(body!, 'base64url');
    flipped[0] = flipped[0]! ^ 1;
    expect(() => decryptSecret(`${iv}.${tag}.${flipped.toString('base64url')}`, KEY)).toThrow();
  });
});
