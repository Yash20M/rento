import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/app-config';

const validUrl = 'postgres://rento:rento@127.0.0.1:5433/rento';
const JWT_SECRET = 'unit-test-jwt-secret-0123456789abcdef';

describe('loadConfig', () => {
  it('U-01 accepts a full valid env and freezes the result', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      HOST: '0.0.0.0',
      PORT: '8080',
      LOG_LEVEL: 'debug',
      DATABASE_URL: validUrl,
      JWT_SECRET,
    });
    expect(config).toMatchObject({
      nodeEnv: 'test',
      host: '0.0.0.0',
      port: 8080,
      logLevel: 'debug',
      databaseUrl: validUrl,
      docsEnabled: true,
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('U-02 applies defaults when only DATABASE_URL is set', () => {
    expect(loadConfig({ DATABASE_URL: validUrl, JWT_SECRET })).toMatchObject({
      nodeEnv: 'development',
      host: '127.0.0.1',
      port: 3000,
      logLevel: 'info',
      docsEnabled: true,
    });
  });

  it('U-03 rejects a missing DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('U-04 lists every bad key at once and never echoes values', () => {
    let message = '';
    try {
      loadConfig({
        PORT: 'abc',
        NODE_ENV: 'prod',
        LOG_LEVEL: 'loud',
        DATABASE_URL: 'mysql://u:hunter2pw@h/db',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      message = (error as Error).message;
    }
    for (const key of ['PORT', 'NODE_ENV', 'LOG_LEVEL', 'DATABASE_URL']) {
      expect(message).toContain(key);
    }
    expect(message).not.toContain('hunter2pw');
    expect(message).not.toContain('abc');
    expect(message).not.toContain('loud');
  });

  it('U-05 disables docs in production', () => {
    expect(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: validUrl,
        JWT_SECRET,
        SMTP_HOST: 'smtp.provider.example',
        MAIL_FROM: 'Rento <no-reply@rento.example>',
        PUBLIC_WEB_URL: 'https://app.rento.example',
      }).docsEnabled,
    ).toBe(false);
  });

  it.each(['0', '65536', '3000.5', '-1'])('rejects out-of-range PORT %s', (port) => {
    expect(() => loadConfig({ PORT: port, DATABASE_URL: validUrl, JWT_SECRET })).toThrow(/PORT/);
  });

  it('treats empty strings as unset (defaults apply)', () => {
    expect(loadConfig({ PORT: '', LOG_LEVEL: '', DATABASE_URL: validUrl, JWT_SECRET }).port).toBe(
      3000,
    );
  });
});

describe('DB_POOL_MAX', () => {
  it('U-01 defaults to 10', () => {
    expect(loadConfig({ DATABASE_URL: validUrl, JWT_SECRET }).dbPoolMax).toBe(10);
  });

  it('U-02 accepts a valid value', () => {
    expect(loadConfig({ DATABASE_URL: validUrl, JWT_SECRET, DB_POOL_MAX: '25' }).dbPoolMax).toBe(
      25,
    );
  });

  it.each(['0', '101', 'abc', '2.5'])('U-03 rejects %s', (value) => {
    expect(() => loadConfig({ DATABASE_URL: validUrl, JWT_SECRET, DB_POOL_MAX: value })).toThrow(
      /DB_POOL_MAX/,
    );
  });
});

describe('auth settings', () => {
  const base = { DATABASE_URL: validUrl, JWT_SECRET };

  it('U-17a defaults: 15 min access tokens, 30 day refresh tokens, no previous secret', () => {
    expect(loadConfig(base)).toMatchObject({
      jwtSecret: JWT_SECRET,
      jwtSecretPrevious: undefined,
      accessTokenTtlSeconds: 900,
      refreshTokenTtlDays: 30,
    });
  });

  it('U-17b accepts overrides and a previous secret for rotation', () => {
    const previous = 'previous-secret-0123456789abcdef-xyz';
    expect(
      loadConfig({
        ...base,
        JWT_SECRET_PREVIOUS: previous,
        ACCESS_TOKEN_TTL_SECONDS: '600',
        REFRESH_TOKEN_TTL_DAYS: '60',
      }),
    ).toMatchObject({
      jwtSecretPrevious: previous,
      accessTokenTtlSeconds: 600,
      refreshTokenTtlDays: 60,
    });
  });

  it('U-17c rejects a missing or short JWT_SECRET without echoing it', () => {
    expect(() => loadConfig({ DATABASE_URL: validUrl })).toThrow(/JWT_SECRET/);
    let message = '';
    try {
      loadConfig({ DATABASE_URL: validUrl, JWT_SECRET: 'too-short-secret' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('JWT_SECRET');
    expect(message).not.toContain('too-short-secret');
  });

  it.each([
    ['ACCESS_TOKEN_TTL_SECONDS', '59'],
    ['ACCESS_TOKEN_TTL_SECONDS', '3601'],
    ['REFRESH_TOKEN_TTL_DAYS', '0'],
    ['REFRESH_TOKEN_TTL_DAYS', '91'],
    ['REFRESH_TOKEN_TTL_DAYS', 'x'],
    ['JWT_SECRET_PREVIOUS', 'short'],
  ])('U-17d rejects %s=%s', (key, value) => {
    expect(() => loadConfig({ ...base, [key]: value })).toThrow(new RegExp(key));
  });
});

describe('mail & link settings', () => {
  const base = { DATABASE_URL: validUrl, JWT_SECRET };
  const production = {
    ...base,
    NODE_ENV: 'production',
    SMTP_HOST: 'smtp.provider.example',
    MAIL_FROM: 'Rento <no-reply@rento.example>',
    PUBLIC_WEB_URL: 'https://app.rento.example',
  };

  it('U-01a defaults are development-friendly (Mailpit-style SMTP, localhost links)', () => {
    expect(loadConfig(base)).toMatchObject({
      publicWebUrl: 'http://localhost:5173',
      smtpHost: undefined,
      smtpPort: 1025,
      smtpSecure: false,
      smtpUser: undefined,
      smtpPassword: undefined,
      verificationTokenTtlHours: 24,
      resetTokenTtlMinutes: 60,
    });
    expect(loadConfig(base).mailFrom).toMatch(/@/);
  });

  it('U-01b overrides are honoured; trailing slashes on the public URL are trimmed', () => {
    expect(
      loadConfig({
        ...base,
        PUBLIC_WEB_URL: 'https://app.rento.example/',
        MAIL_FROM: 'Rento <hello@rento.example>',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: '2525',
        SMTP_SECURE: 'true',
        SMTP_USER: 'user',
        SMTP_PASSWORD: 'pw',
        VERIFICATION_TOKEN_TTL_HOURS: '48',
        RESET_TOKEN_TTL_MINUTES: '30',
      }),
    ).toMatchObject({
      publicWebUrl: 'https://app.rento.example',
      mailFrom: 'Rento <hello@rento.example>',
      smtpHost: '127.0.0.1',
      smtpPort: 2525,
      smtpSecure: true,
      smtpUser: 'user',
      smtpPassword: 'pw',
      verificationTokenTtlHours: 48,
      resetTokenTtlMinutes: 30,
    });
  });

  it('U-01c production needs SMTP_HOST, MAIL_FROM and an https PUBLIC_WEB_URL — all reported together', () => {
    let message = '';
    try {
      loadConfig({ ...base, NODE_ENV: 'production' });
    } catch (error) {
      message = (error as Error).message;
    }
    for (const key of ['SMTP_HOST', 'MAIL_FROM', 'PUBLIC_WEB_URL']) expect(message).toContain(key);

    expect(() => loadConfig(production)).not.toThrow();
    expect(() => loadConfig({ ...production, PUBLIC_WEB_URL: 'http://app.rento.example' })).toThrow(
      /PUBLIC_WEB_URL.*https/,
    );
  });

  it('U-01d SMTP_USER and SMTP_PASSWORD come as a pair, and the password is never echoed', () => {
    let message = '';
    try {
      loadConfig({ ...base, SMTP_PASSWORD: 'hunter2-smtp' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('SMTP_USER');
    expect(message).not.toContain('hunter2-smtp');
    expect(() => loadConfig({ ...base, SMTP_USER: 'u' })).toThrow(/SMTP_USER/);
  });

  it.each([
    ['SMTP_PORT', '0'],
    ['SMTP_PORT', '70000'],
    ['SMTP_SECURE', 'maybe'],
    ['VERIFICATION_TOKEN_TTL_HOURS', '0'],
    ['VERIFICATION_TOKEN_TTL_HOURS', '169'],
    ['RESET_TOKEN_TTL_MINUTES', '4'],
    ['RESET_TOKEN_TTL_MINUTES', '1441'],
    ['PUBLIC_WEB_URL', 'ftp://app.rento.example'],
  ])('U-01e rejects %s=%s', (key, value) => {
    expect(() => loadConfig({ ...base, [key]: value })).toThrow(new RegExp(key));
  });
});

describe('Google sign-in settings', () => {
  const base = { DATABASE_URL: validUrl, JWT_SECRET };

  it("U-1a off by default, with Google's real key endpoint", () => {
    expect(loadConfig(base)).toMatchObject({
      googleClientIds: [],
      googleJwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    });
  });

  it('U-1b client IDs are split, trimmed and de-duplicated; blank entries are dropped', () => {
    expect(
      loadConfig({
        ...base,
        GOOGLE_CLIENT_IDS: ' web.apps.example , android.apps.example,,web.apps.example ',
      }).googleClientIds,
    ).toEqual(['web.apps.example', 'android.apps.example']);
    expect(loadConfig({ ...base, GOOGLE_CLIENT_IDS: '' }).googleClientIds).toEqual([]);
    expect(loadConfig({ ...base, GOOGLE_CLIENT_IDS: ' , ' }).googleClientIds).toEqual([]);
  });

  it('U-1c an entry containing whitespace is rejected without echoing it', () => {
    const attempt = () => loadConfig({ ...base, GOOGLE_CLIENT_IDS: 'good.id,bad id here' });
    expect(attempt).toThrow(ConfigError);
    expect(attempt).toThrow(/GOOGLE_CLIENT_IDS/);
    expect(attempt).not.toThrow(/bad id here/);
  });

  it('U-2 the key endpoint must be an http(s) URL, and https in production', () => {
    expect(() => loadConfig({ ...base, GOOGLE_JWKS_URL: 'ftp://keys.example' })).toThrow(
      /GOOGLE_JWKS_URL/,
    );
    expect(
      loadConfig({ ...base, GOOGLE_JWKS_URL: 'http://127.0.0.1:9999/certs' }).googleJwksUrl,
    ).toBe('http://127.0.0.1:9999/certs');

    const production = {
      ...base,
      NODE_ENV: 'production',
      SMTP_HOST: 'smtp.provider.example',
      MAIL_FROM: 'Rento <no-reply@rento.example>',
      PUBLIC_WEB_URL: 'https://app.rento.example',
    };
    expect(() =>
      loadConfig({ ...production, GOOGLE_JWKS_URL: 'http://keys.example/certs' }),
    ).toThrow(/GOOGLE_JWKS_URL.*https/);
    expect(
      loadConfig({ ...production, GOOGLE_JWKS_URL: 'https://keys.example/certs' }).googleJwksUrl,
    ).toBe('https://keys.example/certs');
  });
});
