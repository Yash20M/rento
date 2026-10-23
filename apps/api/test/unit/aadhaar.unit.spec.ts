import { describe, expect, it } from 'vitest';
import {
  isValidAadhaar,
  maskAadhaar,
  normalizeAadhaar,
  verhoeffCheckDigit,
  verhoeffValid,
} from '../../src/modules/kyc/domain/aadhaar';

/** A well-formed 12-digit number: `payload` (11 digits) plus its check digit. */
export const aadhaarFrom = (payload: string): string => `${payload}${verhoeffCheckDigit(payload)}`;

describe('Aadhaar number checks', () => {
  it('V-1 the check digit scheme agrees with the published Verhoeff examples', () => {
    // 236 → check digit 3 (the classic worked example)
    expect(verhoeffCheckDigit('236')).toBe(3);
    expect(verhoeffValid('2363')).toBe(true);
    expect(verhoeffValid('2364')).toBe(false);
    expect(verhoeffCheckDigit('12345')).toBe(1);
    expect(verhoeffValid('123451')).toBe(true);
  });

  it('V-2 a generated number is valid, and ANY single-digit typo is caught', () => {
    const good = aadhaarFrom('23456789012');
    expect(isValidAadhaar(good)).toBe(true);
    for (let i = 0; i < good.length; i += 1) {
      for (const d of '0123456789') {
        if (d === good[i]) continue;
        const typo = good.slice(0, i) + d + good.slice(i + 1);
        expect(verhoeffValid(typo), typo).toBe(false);
      }
    }
  });

  it('V-3 adjacent digits swapped are caught (the other typical typo)', () => {
    const good = aadhaarFrom('98765432101');
    let caught = 0;
    for (let i = 0; i < good.length - 1; i += 1) {
      if (good[i] === good[i + 1]) continue;
      const swapped = good.slice(0, i) + good[i + 1] + good[i] + good.slice(i + 2);
      expect(isValidAadhaar(swapped), swapped).toBe(false);
      caught += 1;
    }
    expect(caught).toBeGreaterThan(5);
  });

  it('V-4 shape rules: exactly 12 digits, not starting with 0 or 1', () => {
    expect(isValidAadhaar(aadhaarFrom('12345678901'))).toBe(false); // starts with 1
    expect(isValidAadhaar(aadhaarFrom('02345678901'))).toBe(false); // starts with 0
    for (const bad of [
      '',
      '2345',
      '23456789012',
      '2345678901234',
      'abcdefghijkl',
      '2345 6789 0123',
    ]) {
      expect(isValidAadhaar(bad), bad).toBe(false);
    }
  });

  it('V-5 spaces and dashes are tolerated when typing; only the last four digits are ever shown', () => {
    expect(normalizeAadhaar('2345 6789 0123')).toBe('234567890123');
    expect(normalizeAadhaar('2345-6789-0123')).toBe('234567890123');
    expect(maskAadhaar('0123')).toBe('XXXX XXXX 0123');
  });
});
