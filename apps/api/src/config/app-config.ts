import { z } from 'zod';

export type AppConfig = Readonly<{
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  databaseUrl: string;
  dbPoolMax: number;
  jwtSecret: string;
  /** Verify-only secret kept during rotation; new tokens are always signed with `jwtSecret`. */
  jwtSecretPrevious: string | undefined;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  /** Linking a sign-in method needs an access token issued at most this long ago. */
  freshAuthMaxAgeSeconds: number;
  /** Every administrator must have passed the second step (authenticator app) for this session. */
  adminMfaRequired: boolean;
  /** Sensitive admin actions need the second step to have been proved at most this long ago. */
  stepUpMaxAgeSeconds: number;
  /** Key material for the stored authenticator secrets; derived from `jwtSecret` when not set. */
  mfaEncryptionKey: string | undefined;
  /** Name shown in the authenticator app. */
  mfaIssuer: string;
  /** Base URL used to build links in emails (verify / reset). No trailing slash. */
  publicWebUrl: string;
  /** `From:` header of outgoing mail, e.g. `Rento <no-reply@example.com>`. */
  mailFrom: string;
  /** SMTP relay. Undefined ⇒ mail is not delivered (dev fallback only; required in production). */
  smtpHost: string | undefined;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | undefined;
  smtpPassword: string | undefined;
  verificationTokenTtlHours: number;
  resetTokenTtlMinutes: number;
  /** How long an admin invitation link stays valid. */
  adminInvitationTtlHours: number;
  /** How long effective permissions are cached per user (0 = no cache). Changes made on this instance apply at once. */
  permissionCacheTtlSeconds: number;
  /** Nearby-drawer search: how far from the customer a drawer may be (meters) and how many are suggested. */
  discoveryRadiusMeters: number;
  discoveryMaxResults: number;
  /** How long an unpaid booking hold keeps the slot (minutes). */
  holdMinutes: number;
  /** A booking must start at least this many minutes from now, and at most this many days ahead. */
  bookingMinLeadMinutes: number;
  bookingMaxAdvanceDays: number;
  /** Placeholder refund tiers (README BR-9, owner decision Q-5): the first tier whose threshold is met applies. */
  refundTiers: ReadonlyArray<Readonly<{ minutesBeforeStart: number; percent: number }>>;
  /** Staff may hand the item over from this many minutes before the booking starts. */
  pickupEarlyMinutes: number;
  /** Confirmed bookings not picked up this long after the start become no-shows. */
  noShowGraceMinutes: number;
  /** A confirmed booking gets a reminder email this many minutes before it starts; 0 = no reminders. */
  reminderMinutes: number;
  /** Background sweeps (expire holds, overdue, no-show, outbox) run this often; 0 = never (tests call them directly). */
  jobsIntervalSeconds: number;
  /** Web origins allowed to call the API from a browser (Flutter web in a demo, a separately hosted admin). Empty = none. */
  corsAllowedOrigins: readonly string[];
  /** Customers must verify their identity (Aadhaar) before they can book. On unless explicitly switched off. */
  kycRequired: boolean;
  /** Request limits and sign-in lockout (README §15). Off only in tests that do not cover them. */
  rateLimitEnabled: boolean;
  authRatePerIp: number;
  authRatePerAccount: number;
  bookingRatePerUser: number;
  loginMaxFailures: number;
  loginLockMinutes: number;
  /** The one-time code the FAKE identity verifier accepts (demo/dev only; the real verifier sends real OTPs). */
  kycFakeOtp: string;
  /** Which payment gateway adapter is used: the in-process fake (demo) or Razorpay (needs the keys below). */
  paymentProvider: 'fake' | 'razorpay';
  razorpayKeyId: string | undefined;
  razorpayKeySecret: string | undefined;
  razorpayWebhookSecret: string | undefined;
  /** Razorpay API origin; only overridden in tests. */
  razorpayBaseUrl: string | undefined;
  /** Google OAuth client IDs (Android, iOS, Web) a Google ID token may be issued for. Empty ⇒ Google sign-in is off. */
  googleClientIds: readonly string[];
  /** Where Google's signing keys are fetched from (overridable for tests). */
  googleJwksUrl: string;
  /** Meta (Facebook) app credentials. Both set ⇒ Facebook sign-in is on; the secret never leaves the server. */
  /** Apple bundle ID (native) and Services ID (web) a Sign in with Apple token may be issued for. Empty ⇒ Apple sign-in is off. */
  appleClientIds: readonly string[];
  appleJwksUrl: string;
  facebookAppId: string | undefined;
  facebookAppSecret: string | undefined;
  /** Graph API base URL (versionless = the app's configured version; append `/vNN.N` to pin). */
  facebookGraphUrl: string;
  facebookJwksUrl: string;
  docsEnabled: boolean;
  /** Behind a reverse proxy (Render, Fly, nginx): believe `X-Forwarded-For` / `-Proto` for the client address and scheme. */
  trustProxy: boolean;
  /** Folder with the built admin panel (`apps/admin/dist`); when set, the API serves the panel at `/` too. */
  adminStaticDir: string | undefined;
}>;

/** Thrown for invalid environment. The message names keys, never values (DATABASE_URL has a password). */
export class ConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

const isPostgresUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'postgres:' || protocol === 'postgresql:';
  } catch {
    return false;
  }
};

const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

// Empty strings count as "unset" so `PORT=` in a .env file falls back to the default.
const blankToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

/** Integer within [min, max], optional default. Messages never echo the offending value. */
const intInRange = (min: number, max: number, fallback: number) => {
  const message = `must be an integer between ${min} and ${max}`;
  return z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: message })
      .int({ error: message })
      .min(min, { error: message })
      .max(max, { error: message })
      .default(fallback),
  );
};

/** Comma-separated list → trimmed, de-duplicated entries; blank ⇒ none. Entries may not contain whitespace. */
const idList = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '');
    return [...new Set(items)];
  },
  z.array(z.string().regex(/^\S+$/, { error: 'entries must not contain spaces' })).default([]),
);

const httpUrl = z.preprocess(
  blankToUndefined,
  z.string().refine(isHttpUrl, { error: 'must be an http(s) URL' }).optional(),
);

/** "1440:100,120:50,0:0" → tiers sorted from the earliest threshold to the latest; blank ⇒ the placeholder defaults. */
const refundTiers = z.preprocess(
  blankToUndefined,
  z
    .string()
    .default('1440:100,120:50,0:0')
    .transform((value, ctx) => {
      const tiers: Array<{ minutesBeforeStart: number; percent: number }> = [];
      for (const part of value.split(',')) {
        const match = /^(\d{1,6}):(\d{1,3})$/.exec(part.trim());
        const percent = match ? Number(match[2]) : Number.NaN;
        if (!match || percent > 100) {
          ctx.addIssue({
            code: 'custom',
            message: 'use minutes:percent pairs such as 1440:100,120:50,0:0',
          });
          return z.NEVER;
        }
        tiers.push({ minutesBeforeStart: Number(match[1]), percent });
      }
      tiers.sort((a, b) => b.minutesBeforeStart - a.minutesBeforeStart);
      if (tiers[tiers.length - 1]?.minutesBeforeStart !== 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'the last tier must start at 0 minutes (what applies close to the start)',
        });
        return z.NEVER;
      }
      return tiers;
    }),
);

const optionalString = z.preprocess(blankToUndefined, z.string().optional());

const booleanFlag = z.preprocess(
  (value) => {
    if (value === undefined || value === '') return undefined;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value; // fails validation below
  },
  z.boolean({ error: 'must be true or false' }).default(false),
);

const schema = z
  .object({
    NODE_ENV: z.preprocess(
      blankToUndefined,
      z
        .enum(['development', 'test', 'production'], {
          error: 'must be development, test or production',
        })
        .default('development'),
    ),
    HOST: z.preprocess(blankToUndefined, z.string().min(1).default('127.0.0.1')),
    PORT: intInRange(1, 65535, 3000),
    LOG_LEVEL: z.preprocess(
      blankToUndefined,
      z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'], {
          error: 'must be one of fatal, error, warn, info, debug, trace, silent',
        })
        .default('info'),
    ),
    DB_POOL_MAX: intInRange(1, 100, 10),
    JWT_SECRET: z
      .string({ error: 'is required' })
      .min(32, { error: 'must be at least 32 characters' }),
    JWT_SECRET_PREVIOUS: z.preprocess(
      blankToUndefined,
      z.string().min(32, { error: 'must be at least 32 characters' }).optional(),
    ),
    ACCESS_TOKEN_TTL_SECONDS: intInRange(60, 3600, 900),
    REFRESH_TOKEN_TTL_DAYS: intInRange(1, 90, 30),
    FRESH_AUTH_MAX_AGE_SECONDS: intInRange(30, 900, 300),
    ADMIN_MFA_REQUIRED: booleanFlag,
    STEP_UP_MAX_AGE_SECONDS: intInRange(60, 3600, 600),
    MFA_ENCRYPTION_KEY: z.preprocess(
      blankToUndefined,
      z.string().min(32, { error: 'must be at least 32 characters' }).optional(),
    ),
    MFA_ISSUER: z.preprocess(blankToUndefined, z.string().max(40).default('Rento')),
    PUBLIC_WEB_URL: z.preprocess(
      blankToUndefined,
      z.string().refine(isHttpUrl, { error: 'must be an http(s) URL' }).optional(),
    ),
    MAIL_FROM: optionalString,
    SMTP_HOST: optionalString,
    SMTP_PORT: intInRange(1, 65535, 1025),
    SMTP_SECURE: booleanFlag,
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    VERIFICATION_TOKEN_TTL_HOURS: intInRange(1, 168, 24),
    RESET_TOKEN_TTL_MINUTES: intInRange(5, 1440, 60),
    ADMIN_INVITATION_TTL_HOURS: intInRange(1, 720, 168),
    PERMISSION_CACHE_TTL_SECONDS: intInRange(0, 300, 30),
    DISCOVERY_RADIUS_METERS: intInRange(100, 50000, 5000),
    DISCOVERY_MAX_RESULTS: intInRange(1, 10, 3),
    HOLD_MINUTES: intInRange(1, 60, 10),
    BOOKING_MIN_LEAD_MINUTES: intInRange(0, 1440, 15),
    BOOKING_MAX_ADVANCE_DAYS: intInRange(1, 365, 90),
    REFUND_TIERS: refundTiers,
    PICKUP_EARLY_MINUTES: intInRange(0, 240, 15),
    NO_SHOW_GRACE_MINUTES: intInRange(1, 1440, 30),
    REMINDER_MINUTES: intInRange(0, 1440, 60),
    JOBS_INTERVAL_SECONDS: intInRange(0, 3600, 30),
    PAYMENT_PROVIDER: z.preprocess(
      blankToUndefined,
      z.enum(['fake', 'razorpay'], { error: 'must be fake or razorpay' }).default('fake'),
    ),
    RAZORPAY_KEY_ID: optionalString,
    RAZORPAY_KEY_SECRET: optionalString,
    RAZORPAY_WEBHOOK_SECRET: optionalString,
    RAZORPAY_BASE_URL: httpUrl,
    RATE_LIMIT_ENABLED: z.preprocess(
      (v) =>
        v === undefined || v === ''
          ? undefined
          : v === 'true' || v === '1'
            ? true
            : v === 'false' || v === '0'
              ? false
              : v,
      z.boolean({ error: 'must be true or false' }).default(true),
    ),
    AUTH_RATE_PER_IP: intInRange(1, 100000, 60),
    AUTH_RATE_PER_ACCOUNT: intInRange(1, 100000, 10),
    BOOKING_RATE_PER_USER: intInRange(1, 100000, 30),
    LOGIN_MAX_FAILURES: intInRange(1, 1000, 5),
    LOGIN_LOCK_MINUTES: intInRange(1, 1440, 15),
    KYC_REQUIRED: z.preprocess(
      (v) =>
        v === undefined || v === ''
          ? undefined
          : v === 'true' || v === '1'
            ? true
            : v === 'false' || v === '0'
              ? false
              : v,
      z.boolean({ error: 'must be true or false' }).default(true),
    ),
    KYC_FAKE_OTP: z.preprocess(
      blankToUndefined,
      z
        .string()
        .regex(/^\d{6}$/, { error: 'must be 6 digits' })
        .default('123456'),
    ),
    CORS_ALLOWED_ORIGINS: idList,
    TRUST_PROXY: booleanFlag,
    ADMIN_STATIC_DIR: optionalString,
    GOOGLE_CLIENT_IDS: idList,
    GOOGLE_JWKS_URL: httpUrl,
    APPLE_CLIENT_IDS: idList,
    APPLE_JWKS_URL: httpUrl,
    FACEBOOK_APP_ID: optionalString,
    FACEBOOK_APP_SECRET: optionalString,
    FACEBOOK_GRAPH_URL: httpUrl,
    FACEBOOK_JWKS_URL: httpUrl,
    DATABASE_URL: z
      .string({ error: 'is required' })
      .min(1, { error: 'is required' })
      .refine(isPostgresUrl, { error: 'must be a postgres:// or postgresql:// URL' }),
  })
  .superRefine((env, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    if ((env.SMTP_USER === undefined) !== (env.SMTP_PASSWORD === undefined)) {
      fail('SMTP_USER', 'SMTP_USER and SMTP_PASSWORD must be set together');
    }
    if ((env.FACEBOOK_APP_ID === undefined) !== (env.FACEBOOK_APP_SECRET === undefined)) {
      fail('FACEBOOK_APP_ID', 'FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set together');
    }
    if (env.PAYMENT_PROVIDER === 'razorpay') {
      for (const key of [
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET',
      ] as const) {
        if (env[key] === undefined) fail(key, 'is required when PAYMENT_PROVIDER=razorpay');
      }
    }
    for (const origin of env.CORS_ALLOWED_ORIGINS) {
      try {
        const url = new URL(origin);
        const isOrigin =
          (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === origin;
        if (!isOrigin) throw new Error('not an origin');
      } catch {
        fail(
          'CORS_ALLOWED_ORIGINS',
          'entries must be origins such as https://app.example.com (no path, no trailing slash)',
        );
        break;
      }
    }
    if (env.NODE_ENV === 'production') {
      for (const key of [
        'GOOGLE_JWKS_URL',
        'APPLE_JWKS_URL',
        'FACEBOOK_GRAPH_URL',
        'FACEBOOK_JWKS_URL',
      ] as const) {
        const value = env[key];
        if (value !== undefined && !value.startsWith('https://')) {
          fail(key, 'must use https in production');
        }
      }
    }
    if (env.NODE_ENV === 'production') {
      if (env.SMTP_HOST === undefined) fail('SMTP_HOST', 'is required in production');
      if (env.MAIL_FROM === undefined) fail('MAIL_FROM', 'is required in production');
      if (env.PUBLIC_WEB_URL === undefined) fail('PUBLIC_WEB_URL', 'is required in production');
      else if (!env.PUBLIC_WEB_URL.startsWith('https://')) {
        fail('PUBLIC_WEB_URL', 'must use https in production');
      }
    }
  });

export function loadConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${String(issue.path[0] ?? 'env')}: ${issue.message}`,
    );
    throw new ConfigError(problems);
  }
  const parsed = result.data;
  return Object.freeze({
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    databaseUrl: parsed.DATABASE_URL,
    dbPoolMax: parsed.DB_POOL_MAX,
    jwtSecret: parsed.JWT_SECRET,
    jwtSecretPrevious: parsed.JWT_SECRET_PREVIOUS,
    accessTokenTtlSeconds: parsed.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: parsed.REFRESH_TOKEN_TTL_DAYS,
    freshAuthMaxAgeSeconds: parsed.FRESH_AUTH_MAX_AGE_SECONDS,
    adminMfaRequired: parsed.ADMIN_MFA_REQUIRED,
    stepUpMaxAgeSeconds: parsed.STEP_UP_MAX_AGE_SECONDS,
    mfaEncryptionKey: parsed.MFA_ENCRYPTION_KEY,
    mfaIssuer: parsed.MFA_ISSUER,
    publicWebUrl: (parsed.PUBLIC_WEB_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
    mailFrom: parsed.MAIL_FROM ?? 'Rento <no-reply@rento.example>',
    smtpHost: parsed.SMTP_HOST,
    smtpPort: parsed.SMTP_PORT,
    smtpSecure: parsed.SMTP_SECURE,
    smtpUser: parsed.SMTP_USER,
    smtpPassword: parsed.SMTP_PASSWORD,
    verificationTokenTtlHours: parsed.VERIFICATION_TOKEN_TTL_HOURS,
    resetTokenTtlMinutes: parsed.RESET_TOKEN_TTL_MINUTES,
    adminInvitationTtlHours: parsed.ADMIN_INVITATION_TTL_HOURS,
    permissionCacheTtlSeconds: parsed.PERMISSION_CACHE_TTL_SECONDS,
    discoveryRadiusMeters: parsed.DISCOVERY_RADIUS_METERS,
    discoveryMaxResults: parsed.DISCOVERY_MAX_RESULTS,
    holdMinutes: parsed.HOLD_MINUTES,
    bookingMinLeadMinutes: parsed.BOOKING_MIN_LEAD_MINUTES,
    bookingMaxAdvanceDays: parsed.BOOKING_MAX_ADVANCE_DAYS,
    refundTiers: Object.freeze(parsed.REFUND_TIERS.map((tier) => Object.freeze(tier))),
    pickupEarlyMinutes: parsed.PICKUP_EARLY_MINUTES,
    noShowGraceMinutes: parsed.NO_SHOW_GRACE_MINUTES,
    reminderMinutes: parsed.REMINDER_MINUTES,
    jobsIntervalSeconds: parsed.JOBS_INTERVAL_SECONDS,
    paymentProvider: parsed.PAYMENT_PROVIDER,
    razorpayKeyId: parsed.RAZORPAY_KEY_ID,
    razorpayKeySecret: parsed.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: parsed.RAZORPAY_WEBHOOK_SECRET,
    razorpayBaseUrl: parsed.RAZORPAY_BASE_URL,
    kycRequired: parsed.KYC_REQUIRED,
    rateLimitEnabled: parsed.RATE_LIMIT_ENABLED,
    authRatePerIp: parsed.AUTH_RATE_PER_IP,
    authRatePerAccount: parsed.AUTH_RATE_PER_ACCOUNT,
    bookingRatePerUser: parsed.BOOKING_RATE_PER_USER,
    loginMaxFailures: parsed.LOGIN_MAX_FAILURES,
    loginLockMinutes: parsed.LOGIN_LOCK_MINUTES,
    kycFakeOtp: parsed.KYC_FAKE_OTP,
    corsAllowedOrigins: Object.freeze([...parsed.CORS_ALLOWED_ORIGINS]),
    googleClientIds: Object.freeze([...parsed.GOOGLE_CLIENT_IDS]),
    googleJwksUrl: parsed.GOOGLE_JWKS_URL ?? 'https://www.googleapis.com/oauth2/v3/certs',
    appleClientIds: Object.freeze([...parsed.APPLE_CLIENT_IDS]),
    appleJwksUrl: parsed.APPLE_JWKS_URL ?? 'https://appleid.apple.com/auth/keys',
    facebookAppId: parsed.FACEBOOK_APP_ID,
    facebookAppSecret: parsed.FACEBOOK_APP_SECRET,
    facebookGraphUrl: parsed.FACEBOOK_GRAPH_URL ?? 'https://graph.facebook.com',
    facebookJwksUrl:
      parsed.FACEBOOK_JWKS_URL ?? 'https://www.facebook.com/.well-known/oauth/openid/jwks/',
    docsEnabled: parsed.NODE_ENV !== 'production',
    trustProxy: parsed.TRUST_PROXY,
    adminStaticDir: parsed.ADMIN_STATIC_DIR,
  });
}
