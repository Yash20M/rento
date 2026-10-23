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

describe('Meta (Facebook) sign-in settings', () => {
  it('U-3a off by default, with the real Meta endpoints', () => {
    expect(loadConfig(base)).toMatchObject({
      facebookAppId: undefined,
      facebookAppSecret: undefined,
      facebookGraphUrl: 'https://graph.facebook.com',
      facebookJwksUrl: 'https://www.facebook.com/.well-known/oauth/openid/jwks/',
    });
  });

  it('U-3b app id and secret are set together or not at all, and the secret is never echoed', () => {
    expect(
      loadConfig({ ...base, FACEBOOK_APP_ID: '123', FACEBOOK_APP_SECRET: 'shh-secret' }),
    ).toMatchObject({ facebookAppId: '123', facebookAppSecret: 'shh-secret' });

    for (const only of [{ FACEBOOK_APP_ID: '123' }, { FACEBOOK_APP_SECRET: 'shh-secret' }]) {
      const attempt = () => loadConfig({ ...base, ...only });
      expect(attempt).toThrow(/FACEBOOK_APP_ID and FACEBOOK_APP_SECRET/);
      expect(attempt).not.toThrow(/shh-secret/);
    }
  });

  it('U-3c Meta URLs must be http(s), and https in production', () => {
    expect(() => loadConfig({ ...base, FACEBOOK_GRAPH_URL: 'ftp://x' })).toThrow(
      /FACEBOOK_GRAPH_URL/,
    );
    expect(() => loadConfig({ ...base, FACEBOOK_JWKS_URL: 'nope' })).toThrow(/FACEBOOK_JWKS_URL/);
    expect(() => loadConfig({ ...production, FACEBOOK_GRAPH_URL: 'http://graph.example' })).toThrow(
      /FACEBOOK_GRAPH_URL.*https/,
    );
    expect(() => loadConfig({ ...production, FACEBOOK_JWKS_URL: 'http://keys.example' })).toThrow(
      /FACEBOOK_JWKS_URL.*https/,
    );
    expect(
      loadConfig({ ...production, FACEBOOK_GRAPH_URL: 'https://graph.facebook.com/v24.0' })
        .facebookGraphUrl,
    ).toBe('https://graph.facebook.com/v24.0');
  });
});
