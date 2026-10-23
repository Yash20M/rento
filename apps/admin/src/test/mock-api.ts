export const jsonResponse = (body: unknown, status = 200, contentType = 'application/json') =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': contentType },
  });

export const problemResponse = (
  status: number,
  code: string,
  detail: string,
  errors?: Array<{ field: string; message: string }>,
) =>
  jsonResponse(
    {
      type: `urn:rento:problem:${code.toLowerCase()}`,
      title: 'Problem',
      status,
      code,
      detail,
      ...(errors && { errors }),
      traceId: 'trace-test',
    },
    status,
    'application/problem+json',
  );

export interface RecordedCall {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  authorization: string | null;
  headers: Headers;
}

export interface Incoming {
  url: URL;
  params: Record<string, string>;
  body: unknown;
  headers: Headers;
}

type Result = Response | object | undefined;
export type Handler = Result | ((request: Incoming) => Result | Promise<Result>);

const compile = (pattern: string): { method: string; regex: RegExp; names: string[] } => {
  const [method = 'GET', path = ''] = pattern.split(' ');
  const names: string[] = [];
  const source = path.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  return { method, regex: new RegExp(`^${source}$`), names };
};

/**
 * A stand-in for the Rento API: routes like `'GET /v1/admin/bookings/:id'` map to a handler or a fixed body. Every call
 * is recorded so tests can assert what the UI actually sent. Unknown routes answer a 404 problem.
 */
export function mockApi(routes: Record<string, Handler> = {}) {
  const table = new Map<string, Handler>(Object.entries(routes));
  const calls: RecordedCall[] = [];

  const fetchStub = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const text =
      request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text();
    let body: unknown;
    if (text !== '') {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text; // a file upload, not JSON
      }
    }
    calls.push({
      method,
      path: url.pathname,
      query: url.searchParams,
      body,
      authorization: request.headers.get('authorization'),
      headers: request.headers,
    });

    for (const [pattern, handler] of [...table].reverse()) {
      const { method: m, regex, names } = compile(pattern);
      const match = regex.exec(url.pathname);
      if (m !== method || !match) continue;
      const params = Object.fromEntries(
        names.map((name, i) => [name, decodeURIComponent(match[i + 1] ?? '')]),
      );
      const result =
        typeof handler === 'function'
          ? await handler({ url, params, body, headers: request.headers })
          : handler;
      if (result instanceof Response) return result;
      return result === undefined ? new Response(null, { status: 204 }) : jsonResponse(result);
    }
    return problemResponse(404, 'NOT_FOUND', `No mock for ${method} ${url.pathname}`);
  };

  return {
    fetch: fetchStub,
    calls,
    /** Add or replace a route (the latest definition wins). */
    on(pattern: string, handler: Handler) {
      table.set(pattern, handler);
    },
    /** Calls to a route, e.g. `api.callsTo('POST', '/v1/auth/login')`. */
    callsTo(method: string, path: string): RecordedCall[] {
      return calls.filter((c) => c.method === method && c.path === path);
    },
  };
}

export type MockApi = ReturnType<typeof mockApi>;
