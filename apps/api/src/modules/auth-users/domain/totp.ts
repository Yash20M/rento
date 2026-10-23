import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238, HMAC-SHA1, 6 digits, 30 s) and the small helpers around them: the secret's
 * text form, the `otpauth://` address the authenticator app reads, recovery codes, and encryption of the stored secret.
 * Pure code: the caller supplies the time.
 */
export const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const newSecret = (): Buffer => randomBytes(20);

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('not base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const stepOf = (at: Date): number => Math.floor(at.getTime() / 1000 / STEP_SECONDS);

/** The code for one 30-second step. */
export function codeFor(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', secret).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 15;
  const binary =
    ((hmac[offset]! & 127) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * The step this code belongs to, if it is right for now or one step either side (clock drift between phone and
 * server), and later than `lastUsedStep`: a code — or an older one — never works twice.
 */
export function matchingStep(
  secret: Buffer,
  code: string,
  now: Date,
  lastUsedStep: number | null,
): number | undefined {
  if (!/^\d{6}$/.test(code)) return undefined;
  const current = stepOf(now);
  for (const step of [current, current - 1, current + 1]) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    if (safeEqual(codeFor(secret, step), code)) return step;
  }
  return undefined;
}

/** What the authenticator app scans (as a QR code) or accepts as a link. */
export const otpauthUri = (issuer: string, account: string, secret: Buffer): string =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
  `?secret=${base32Encode(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;

// ---- recovery codes: 10 characters from an alphabet without look-alikes, shown as `XXXXX-XXXXX`
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RECOVERY_CODE_COUNT = 10;

export function newRecoveryCode(): string {
  const bytes = randomBytes(10);
  let raw = '';
  for (const byte of bytes) raw += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Accepts what a person types: any case, with or without the dash or spaces. */
export const normalizeRecoveryCode = (text: string): string =>
  text.replace(/[\s-]/g, '').toUpperCase();

export const hashRecoveryCode = (text: string): string =>
  createHash('sha256')
    .update(`rento-recovery:${normalizeRecoveryCode(text)}`)
    .digest('hex');

// ---- encryption of the stored secret (AES-256-GCM; the key is derived, never stored)
const keyFrom = (material: string): Buffer =>
  Buffer.from(hkdfSync('sha256', material, 'rento', 'mfa-secret-v1', 32));

export function encryptSecret(secret: Buffer, material: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(material), iv);
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.');
}

export function decryptSecret(stored: string, material: string): Buffer {
  const [iv, tag, body] = stored.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !body) throw new Error('malformed secret');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(material), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}
