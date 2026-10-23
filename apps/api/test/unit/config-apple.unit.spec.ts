import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/app-config';

const base = {
  DATABASE_URL: 'postgres://rento:rento@127.0.0.1:5433/rento',
  JWT_SECRET: 'unit-test-jwt-secret-0123456789abcdef',
};
const production = {
  ...base,
  NODE_ENV: 'production',
  SMTP_HOST: 'smtp.provider.example',
  MAIL_FROM: 'Rento <no-reply@rento.example>',
  PUBLIC_WEB_URL: 'https://app.rento.example',
};

describe('Apple sign-in settings', () => {
  it("U-4a off by default, with Apple's real key endpoint", () => {
    expect(loadConfig(base)).toMatchObject({
      appleClientIds: [],
      appleJwksUrl: 'https://appleid.apple.com/auth/keys',
    });
  });

  it('U-4b client IDs are split, trimmed and de-duplicated', () => {
    expect(
      loadConfig({ ...base, APPLE_CLIENT_IDS: ' com.rento.app , com.rento.web,,com.rento.app' })
        .appleClientIds,
    ).toEqual(['com.rento.app', 'com.rento.web']);
    expect(loadConfig({ ...base, APPLE_CLIENT_IDS: '' }).appleClientIds).toEqual([]);
  });

  it('U-4c an ID containing spaces is rejected without echoing it', () => {
    const attempt = () => loadConfig({ ...base, APPLE_CLIENT_IDS: 'bad id value' });
    expect(attempt).toThrow(/APPLE_CLIENT_IDS/);
    expect(attempt).not.toThrow(/bad id value/);
  });

  it('U-4d the key endpoint must be http(s), and https in production', () => {
    expect(() => loadConfig({ ...base, APPLE_JWKS_URL: 'ftp://x' })).toThrow(/APPLE_JWKS_URL/);
    expect(() => loadConfig({ ...production, APPLE_JWKS_URL: 'http://keys.example' })).toThrow(
      /APPLE_JWKS_URL.*https/,
    );
  });
});

describe('fresh-auth window', () => {
  it('U-5 defaults to 5 minutes and is bounded', () => {
    expect(loadConfig(base).freshAuthMaxAgeSeconds).toBe(300);
    expect(loadConfig({ ...base, FRESH_AUTH_MAX_AGE_SECONDS: '60' }).freshAuthMaxAgeSeconds).toBe(
      60,
    );
    for (const bad of ['10', '901', 'abc']) {
      expect(() => loadConfig({ ...base, FRESH_AUTH_MAX_AGE_SECONDS: bad })).toThrow(
        /FRESH_AUTH_MAX_AGE_SECONDS/,
      );
    }
  });
});

describe('admin invitation window', () => {
  it('U-6 defaults to 7 days and is bounded to 1 hour … 30 days', () => {
    expect(loadConfig(base).adminInvitationTtlHours).toBe(168);
    expect(loadConfig({ ...base, ADMIN_INVITATION_TTL_HOURS: '24' }).adminInvitationTtlHours).toBe(
      24,
    );
    for (const bad of ['0', '721', 'abc']) {
      expect(() => loadConfig({ ...base, ADMIN_INVITATION_TTL_HOURS: bad })).toThrow(
        /ADMIN_INVITATION_TTL_HOURS/,
      );
    }
  });
});
