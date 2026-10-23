import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  type CryptoKey,
  type JWK,
  SignJWT,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
} from 'jose';

interface KeyEntry {
  privateKey: CryptoKey;
  publicJwk: JWK;
}

export type JwksMode = 'ok' | 'server-error' | 'bad-json';

const b64url = (value: object | string): string =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

/**
 * A real HTTP server that plays the part of Google's certificate endpoint, plus the matching token signer. Keys can
 * be added and retired (rotation), the response headers and failure mode are adjustable, and every request is counted.
 */
export class FakeJwksServer {
  readonly keys = new Map<string, KeyEntry>();
  /** `Cache-Control` header to send (undefined ⇒ none). */
  cacheControl: string | undefined = 'public, max-age=3600';
  mode: JwksMode = 'ok';
  fetchCount = 0;

  private constructor(
    private readonly server: Server,
    readonly url: string,
  ) {}

  static async start(): Promise<FakeJwksServer> {
    const holder: { self?: FakeJwksServer } = {};
    const server = createServer((_request, response) => {
      const self = holder.self;
      if (!self) return;
      self.fetchCount += 1;
      if (self.mode === 'server-error') {
        response.writeHead(500).end('boom');
        return;
      }
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (self.cacheControl !== undefined) headers['cache-control'] = self.cacheControl;
      response.writeHead(200, headers);
      response.end(
        self.mode === 'bad-json'
          ? '{ not json'
          : JSON.stringify({ keys: [...self.keys.values()].map((entry) => entry.publicJwk) }),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const self = new FakeJwksServer(server, `http://127.0.0.1:${port}/certs`);
    holder.self = self;
    await self.addKey('key-1');
    return self;
  }

  async addKey(kid: string): Promise<void> {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    const publicJwk = await exportJWK(publicKey);
    this.keys.set(kid, { privateKey, publicJwk: { ...publicJwk, kid, alg: 'RS256', use: 'sig' } });
  }

  removeKey(kid: string): void {
    this.keys.delete(kid);
  }

  /** A token as Google would sign it (RS256, header `kid`). Claims default to a valid token for `aud`. */
  async sign(
    claims: JWTPayload,
    options: { kid?: string; signWith?: CryptoKey; header?: Record<string, unknown> } = {},
  ): Promise<string> {
    const kid = options.kid ?? 'key-1';
    const key = options.signWith ?? this.keys.get(kid)?.privateKey;
    if (!key) throw new Error(`no signing key for ${kid}`);
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT', ...options.header })
      .sign(key);
  }

  /** A fresh key pair the server never publishes: signatures from it must not verify. */
  async unpublishedKey(): Promise<CryptoKey> {
    return (await generateKeyPair('RS256')).privateKey;
  }

  /** `alg=none` token with a plausible header and payload, no signature. */
  unsigned(claims: JWTPayload, kid = 'key-1'): string {
    return `${b64url({ alg: 'none', kid, typ: 'JWT' })}.${b64url(claims)}.`;
  }

  /** HS256 token MAC'd with the published public key material — the classic algorithm-confusion attack. */
  async hmacWithPublicKey(claims: JWTPayload, kid = 'key-1'): Promise<string> {
    const jwk = this.keys.get(kid)?.publicJwk;
    if (!jwk) throw new Error(`no key ${kid}`);
    const secret = new TextEncoder().encode(JSON.stringify(jwk));
    return new SignJWT(claims).setProtectedHeader({ alg: 'HS256', kid }).sign(secret);
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
      this.server.closeAllConnections();
    });
  }
}
