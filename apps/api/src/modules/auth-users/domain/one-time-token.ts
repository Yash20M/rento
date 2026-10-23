import { generateRefreshToken, hashRefreshToken } from './refresh-token';

// Email-verification and password-reset links use the same primitive as refresh tokens: 256 random bits shown once
// (in the emailed link), stored only as a SHA-256 hash.
export const generateOneTimeToken = generateRefreshToken;
export const hashOneTimeToken = hashRefreshToken;

export type OneTimePurpose = 'email_verification' | 'password_reset';

/** At most one mail per user and purpose per minute (abuse / double-click protection). */
export const MAIL_COOLDOWN_MS = 60_000;
