import { createHash, createHmac } from 'node:crypto';
import { decodeProtectedHeader, jwtVerify } from 'jose';
import type { Clock } from '../../../../common/clock/clock';
import { RetryLaterError } from '../../../../db/errors';
import {
  type SocialCredentials,
  type SocialIdentityVerifier,
  SocialTokenInvalidError,
  type VerifiedSocialIdentity,
} from '../../domain/social';
import { type JwksLogger, JwksCache } from '../shared/jwks-cache';

export const FACEBOOK_ISSUER = 'https://www.facebook.com';
const MAX_ACCESS_TOKEN = 4096;
const MAX_OIDC_TOKEN = 8192;
const MAX_NONCE = 256;
const CLOCK_TOLERANCE_SECONDS = 10;
const DEFAULT_TIMEOUT_MS = 5000;

export interface FacebookVerifierSettings {
  appId: string;
  /** Server-side only. Never logged, never returned. */
  appSecret: string;
  /** Graph API base, e.g. `https://graph.facebook.com` (add `/v24.0` to pin a version). */
  graphUrl: string;
  jwksUrl: string;
  timeoutMs?: number;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');
const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

/**
 * Verifies Meta (Facebook) sign-in tokens (README §15.1):
 *  - Classic Login access token: Graph `debug_token` (our app, valid, a USER token, unexpired), then `/me`.
 *  - iOS Limited Login OIDC token: RS256 signature against Meta's keys, issuer, audience = our app, expiry, and the
 *    nonce the app supplied.
 * The Facebook email is NEVER reported as verified, so it can never auto-link accounts (BR-19).
 */
export class FacebookIdentityVerifier implements SocialIdentityVerifier {
  private readonly keys: JwksCache;

  constructor(
    private readonly settings: FacebookVerifierSettings,
    private readonly clock: Clock,
    private readonly logger: JwksLogger,
  ) {
    this.keys = new JwksCache(settings.jwksUrl, clock, logger);
  }

  verify(credentials: SocialCredentials): Promise<VerifiedSocialIdentity> {
    if (credentials.provider !== 'facebook') return Promise.reject(new SocialTokenInvalidError());
    if ('accessToken' in credentials) return this.verifyAccessToken(credentials.accessToken);
    if ('authenticationToken' in credentials) {
      return this.verifyAuthenticationToken(credentials.authenticationToken, credentials.nonce);
    }
    return Promise.reject(new SocialTokenInvalidError());
  }

  // ── Classic Login ───────────────────────────────────────────────────────────────────────────────

  private async verifyAccessToken(accessToken: string): Promise<VerifiedSocialIdentity> {
    if (accessToken === '' || accessToken.length > MAX_ACCESS_TOKEN) {
      throw new SocialTokenInvalidError();
    }

    const debug = await this.graph('/debug_token', {
      input_token: accessToken,
      access_token: `${this.settings.appId}|${this.settings.appSecret}`,
    });
    const data = isObject(debug) ? debug['data'] : undefined;
    if (!isObject(data)) throw new SocialTokenInvalidError();

    const userId = text(data['user_id']);
    const expiresAt = data['expires_at'];
    const expired =
      typeof expiresAt === 'number' && expiresAt !== 0 && expiresAt <= this.nowSeconds();
    if (
      data['is_valid'] !== true ||
      data['app_id'] !== this.settings.appId ||
      data['type'] !== 'USER' ||
      userId === null ||
      expired
    ) {
      throw new SocialTokenInvalidError();
    }

    const me = await this.graph('/me', {
      fields: 'id,name,email',
      access_token: accessToken,
      appsecret_proof: createHmac('sha256', this.settings.appSecret)
        .update(accessToken)
        .digest('hex'),
    });
    if (!isObject(me) || me['id'] !== userId) throw new SocialTokenInvalidError();

    return {
      provider: 'facebook',
      subject: userId,
      email: text(me['email']),
      emailVerified: false,
      name: text(me['name']),
    };
  }

  /** GET on the Graph API. 4xx ⇒ the token was refused; 5xx/429/network/garbage ⇒ Meta is unavailable. */
  private async graph(path: string, query: Record<string, string>): Promise<unknown> {
    const url = new URL(`${this.settings.graphUrl.replace(/\/+$/, '')}${path}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.settings.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      // Never log the URL (it carries tokens) or the error message (it may echo the URL).
      this.logger.warn(
        `Meta Graph API unreachable (${error instanceof Error ? error.name : 'error'})`,
      );
      throw new RetryLaterError();
    }

    if (response.status >= 500 || response.status === 429) {
      this.logger.warn(`Meta Graph API unavailable (status=${response.status})`);
      throw new RetryLaterError();
    }
    if (response.status >= 400) {
      // Visible to operators: a wrong FACEBOOK_APP_SECRET also shows up as Meta refusing every token. Status and Meta's
      // numeric error code only: no token, no URL, no message text.
      this.logger.warn(
        `Meta Graph API refused a token (status=${response.status}, code=${await this.errorCode(response)})`,
      );
      throw new SocialTokenInvalidError();
    }

    try {
      return JSON.parse(await response.text()) as unknown;
    } catch {
      this.logger.warn('Meta Graph API returned an unreadable answer');
      throw new RetryLaterError();
    }
  }

  private async errorCode(response: Response): Promise<string> {
    try {
      const body = JSON.parse(await response.text()) as unknown;
      const code = isObject(body) && isObject(body['error']) ? body['error']['code'] : undefined;
      return typeof code === 'number' ? String(code) : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // ── Limited Login ───────────────────────────────────────────────────────────────────────────────

  private async verifyAuthenticationToken(
    token: string,
    nonce: string,
  ): Promise<VerifiedSocialIdentity> {
    if (token === '' || token.length > MAX_OIDC_TOKEN) throw new SocialTokenInvalidError();
    if (nonce === '' || nonce.length > MAX_NONCE) throw new SocialTokenInvalidError();

    let kid: string | undefined;
    try {
      kid = decodeProtectedHeader(token).kid;
    } catch {
      throw new SocialTokenInvalidError();
    }
    const resolver = await this.keys.resolverFor(kid); // key-endpoint trouble ⇒ RetryLaterError

    let payload;
    try {
      ({ payload } = await jwtVerify(token, resolver, {
        algorithms: ['RS256'],
        issuer: FACEBOOK_ISSUER,
        audience: this.settings.appId,
        requiredClaims: ['sub', 'exp', 'iss', 'aud', 'nonce'],
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        currentDate: this.clock.now(),
      }));
    } catch {
      throw new SocialTokenInvalidError();
    }

    const subject = text(payload.sub);
    // Meta's documentation does not say whether the claim is the raw nonce or its hash; both prove the same thing
    // (the app that started this login knows the nonce), so both are accepted, as for Apple.
    const claimed = payload['nonce'];
    if (subject === null || (claimed !== nonce && claimed !== sha256Hex(nonce))) {
      throw new SocialTokenInvalidError();
    }
    return {
      provider: 'facebook',
      subject,
      email: text(payload['email']),
      emailVerified: false,
      name: text(payload['name']),
    };
  }

  private nowSeconds(): number {
    return Math.floor(this.clock.now().getTime() / 1000);
  }
}
