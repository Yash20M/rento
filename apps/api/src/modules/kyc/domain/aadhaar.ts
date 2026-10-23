// Verhoeff checksum tables (the check-digit scheme used by Aadhaar numbers).
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
] as const;
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
] as const;
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9] as const;

/** Is the digit string a valid Verhoeff number (checksum digit included)? */
export function verhoeffValid(digits: string): boolean {
  let c = 0;
  const reversed = [...digits].reverse().map(Number);
  for (let i = 0; i < reversed.length; i += 1) {
    c = D[c]![P[i % 8]![reversed[i]!]!]!;
  }
  return c === 0;
}

/** The Verhoeff check digit to append to `payload` (used to build test numbers). */
export function verhoeffCheckDigit(payload: string): number {
  let c = 0;
  const reversed = [...payload].reverse().map(Number);
  for (let i = 0; i < reversed.length; i += 1) {
    c = D[c]![P[(i + 1) % 8]![reversed[i]!]!]!;
  }
  return INV[c]!;
}

/** Digits only (people type spaces or dashes: `2345 6789 0124`). */
export const normalizeAadhaar = (input: string): string => input.replace(/[\s-]/g, '');

/**
 * A plausible Aadhaar number: exactly 12 digits, not starting with 0 or 1, with a valid Verhoeff check digit. This only
 * rejects typos; whether the card exists and belongs to the person is the verification service's job.
 */
export const isValidAadhaar = (digits: string): boolean =>
  /^[2-9][0-9]{11}$/.test(digits) && verhoeffValid(digits);

/** `XXXX XXXX 1234` — the only form of the number that is ever shown. */
export const maskAadhaar = (last4: string): string => `XXXX XXXX ${last4}`;
