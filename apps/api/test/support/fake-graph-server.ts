import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  path: string;
  query: URLSearchParams;
  headers: Record<string, string | string[] | undefined>;
}

interface Reply {
  status: number;
  body: unknown;
}

/**
 * Stands in for Meta's Graph API: `/debug_token` and `/me`, with replies the test sets and every request recorded.
 * `hang` makes the next replies never arrive (to exercise client timeouts).
 */
export class FakeGraphServer {
  readonly requests: RecordedRequest[] = [];
  debug: Reply | (() => Reply) = FakeGraphServer.validDebug();
  me: Reply | (() => Reply) = FakeGraphServer.validMe();
  hang = false;

  private constructor(
    private readonly server: Server,
    readonly url: string,
  ) {}

  static validDebug(overrides: Record<string, unknown> = {}): Reply {
    return {
      status: 200,
      body: {
        data: {
          app_id: 'app-123',
          type: 'USER',
          application: 'Rento',
          is_valid: true,
          expires_at: 0,
          user_id: 'fb-user-1',
          scopes: ['public_profile', 'email'],
          ...overrides,
        },
      },
    };
  }

  static validMe(overrides: Record<string, unknown> = {}): Reply {
    return {
      status: 200,
      body: { id: 'fb-user-1', name: 'Farah Khan', email: 'farah@example.com', ...overrides },
    };
  }

  static async start(): Promise<FakeGraphServer> {
    const holder: { self?: FakeGraphServer } = {};
    const server = createServer((request, response) => {
      const self = holder.self;
      if (!self) return;
      const url = new URL(request.url ?? '/', 'http://localhost');
      self.requests.push({ path: url.pathname, query: url.searchParams, headers: request.headers });
      if (self.hang) return; // never answer
      const pick = url.pathname === '/debug_token' ? self.debug : self.me;
      const reply = typeof pick === 'function' ? pick() : pick;
      response.writeHead(reply.status, { 'content-type': 'application/json' });
      response.end(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const self = new FakeGraphServer(server, `http://127.0.0.1:${port}`);
    holder.self = self;
    return self;
  }

  reset(): void {
    this.requests.length = 0;
    this.debug = FakeGraphServer.validDebug();
    this.me = FakeGraphServer.validMe();
    this.hang = false;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
      this.server.closeAllConnections();
    });
  }
}
