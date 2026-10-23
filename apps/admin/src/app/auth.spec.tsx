import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createAuthedClient } from '@/api/authed-client';
import { SessionStore } from '@/auth/session';
import { meWith, problemResponse, renderApp, superAdminMe, tokens } from '@/test/render';
import { mockApi } from '@/test/mock-api';

const signInAs = async (email: string, password: string) => {
  await userEvent.type(await screen.findByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
};

describe('signing in', () => {
  it('A-01 an anonymous visitor is sent to the sign-in page', async () => {
    const { router } = renderApp('/');
    expect(
      await screen.findByRole('heading', { name: /sign in to rento admin/i }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('A-02 the sign-in button stays disabled until both fields are filled', async () => {
    renderApp('/login');
    const button = await screen.findByRole('button', { name: /sign in/i });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Email'), 'owner@rento.demo');
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    expect(button).toBeEnabled();
  });

  it('A-03 valid credentials open the dashboard; only the access token is held (memory), nothing is stored in the browser', async () => {
    const api = mockApi({
      'POST /v1/auth/session/login': tokens(1),
      'GET /v1/admin/me': superAdminMe,
      'GET /v1/admin/dashboard': {
        generatedAt: '2030-01-01T00:00:00Z',
        windowDays: 7,
        now: { held: 0, confirmed: 0, active: 0, overdue: 0 },
        lastDays: {
          completed: 0,
          cancelled: 0,
          noShow: 0,
          expired: 0,
          grossPaise: 0,
          refundedPaise: 0,
        },
        upcoming: [],
      },
    });
    const { session, router } = renderApp('/login', { api });
    await signInAs('owner@rento.demo', 'a long enough password');

    expect(await screen.findByRole('heading', { name: /welcome, owner/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(api.callsTo('POST', '/v1/auth/session/login')[0]?.body).toEqual({
      email: 'owner@rento.demo',
      password: 'a long enough password',
    });
    expect(api.callsTo('GET', '/v1/admin/me')[0]?.authorization).toBe('Bearer access-1');
    expect(session.accessToken).toBe('access-1');
    expect(window.localStorage.length).toBe(0); // nothing is parked in browser storage
    expect(window.sessionStorage.length).toBe(0);
  });

  it('A-04 a wrong password shows one generic message and keeps the person on the form', async () => {
    const api = mockApi({
      'POST /v1/auth/session/login': problemResponse(
        401,
        'UNAUTHENTICATED',
        'Invalid email or password',
      ),
    });
    const { session } = renderApp('/login', { api });
    await signInAs('owner@rento.demo', 'wrong password!!');
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
    expect(session.accessToken).toBeUndefined();
  });

  it('A-05 a valid account without admin access is refused and no session is kept', async () => {
    const api = mockApi({
      'POST /v1/auth/session/login': tokens(1),
      'GET /v1/admin/me': problemResponse(403, 'PERMISSION_DENIED', 'No admin access'),
    });
    const { session } = renderApp('/login', { api });
    await signInAs('customer@example.com', 'a long enough password');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no access to the admin panel/i);
    expect(session.accessToken).toBeUndefined();
  });

  it('A-06 after signing in the person lands where they were heading', async () => {
    const api = mockApi({
      'POST /v1/auth/session/login': tokens(1),
      'GET /v1/admin/me': superAdminMe,
      'GET /v1/admin/bookings': { items: [], nextCursor: null },
      'GET /v1/admin/drawers': [],
    });
    const { router } = renderApp('/bookings', { api });
    await signInAs('owner@rento.demo', 'a long enough password');
    expect(await screen.findByRole('heading', { name: 'Bookings' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/bookings');
  });

  it('A-07 an open-redirect style "from" is ignored', async () => {
    const api = mockApi({
      'POST /v1/auth/session/login': tokens(1),
      'GET /v1/admin/me': superAdminMe,
    });
    const { router } = renderApp('/login', { api });
    await router.navigate('/login', { state: { from: '//evil.example/steal' } });
    await signInAs('owner@rento.demo', 'a long enough password');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

describe('keeping the session', () => {
  it('A-08 a reload restores the session from the refresh cookie (no sign-in form; the call carries the CSRF header)', async () => {
    const { api, session } = renderApp('/', { me: superAdminMe });
    expect(await screen.findByRole('heading', { name: /welcome, owner/i })).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/auth/session/refresh')).toHaveLength(1);
    expect(
      api.calls.find((c) => c.path === '/v1/auth/session/refresh')?.headers.get('x-requested-with'),
    ).toBe('rento-web');
    expect(session.accessToken).toBe('access-1');
  });

  it('A-09 a refused or missing refresh cookie at start-up leads to the sign-in page', async () => {
    const session = new SessionStore();
    const api = mockApi({
      'POST /v1/auth/session/refresh': problemResponse(
        401,
        'UNAUTHENTICATED',
        'Invalid refresh token',
      ),
    });
    renderApp('/', { api, session });
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(session.accessToken).toBeUndefined();
  });

  it('A-10 an expired access token is refreshed silently and the request repeated', async () => {
    const session = new SessionStore();
    session.setAccess('old');
    let first = true;
    const api = mockApi({
      'POST /v1/auth/session/refresh': tokens(2),
      'GET /v1/admin/me': () => {
        if (first) {
          first = false;
          return problemResponse(401, 'TOKEN_EXPIRED', 'Access token expired');
        }
        return superAdminMe;
      },
    });
    const client = createAuthedClient('http://api.test', session, api.fetch);
    const result = await client.GET('/v1/admin/me');
    expect(result.response.status).toBe(200);
    expect(api.callsTo('POST', '/v1/auth/session/refresh')).toHaveLength(1);
    expect(api.callsTo('GET', '/v1/admin/me').map((c) => c.authorization)).toEqual([
      'Bearer old',
      'Bearer access-2',
    ]);
    expect(session.accessToken).toBe('access-2');
  });

  it('A-11 several requests that fail at once cause ONE refresh (a second one would revoke the session family)', async () => {
    const session = new SessionStore();
    session.setAccess('old');
    const api = mockApi({
      'POST /v1/auth/session/refresh': async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return tokens(2);
      },
      'GET /v1/admin/roles': ({ headers }) =>
        headers.get('authorization') === 'Bearer access-2'
          ? []
          : problemResponse(401, 'TOKEN_EXPIRED', 'Access token expired'),
    });
    const client = createAuthedClient('http://api.test', session, api.fetch);
    const results = await Promise.all([
      client.GET('/v1/admin/roles'),
      client.GET('/v1/admin/roles'),
      client.GET('/v1/admin/roles'),
    ]);
    expect(results.map((r) => r.response.status)).toEqual([200, 200, 200]);
    expect(api.callsTo('POST', '/v1/auth/session/refresh')).toHaveLength(1);
  });

  it('A-12 when the refresh is refused mid-session, the person is signed out', async () => {
    const api = mockApi({
      'GET /v1/admin/dashboard': problemResponse(401, 'TOKEN_EXPIRED', 'Access token expired'),
    });
    const { session } = renderApp('/', { me: superAdminMe, api });
    // The first refresh (restoring the session) works; the next one — triggered by the expired dashboard request —
    // is refused, which ends the session.
    let refreshes = 0;
    api.on('POST /v1/auth/session/refresh', () => {
      refreshes += 1;
      return refreshes === 1
        ? tokens(1)
        : problemResponse(401, 'UNAUTHENTICATED', 'Refresh token revoked');
    });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument(),
    );
    expect(session.accessToken).toBeUndefined();
  });

  it('A-13 only a 401 TOKEN_EXPIRED triggers a refresh — other errors pass through untouched', async () => {
    const session = new SessionStore();
    session.setAccess('a');
    const api = mockApi({
      'GET /v1/admin/roles': problemResponse(403, 'PERMISSION_DENIED', 'no'),
      'GET /v1/admin/drawers': problemResponse(401, 'UNAUTHENTICATED', 'no'),
    });
    const client = createAuthedClient('http://api.test', session, api.fetch);
    expect((await client.GET('/v1/admin/roles')).response.status).toBe(403);
    expect((await client.GET('/v1/admin/drawers')).response.status).toBe(401);
    expect(api.callsTo('POST', '/v1/auth/session/refresh')).toHaveLength(0);
  });

  it('A-14 signing out calls the API, forgets the session and shows the sign-in page', async () => {
    const { api, session } = renderApp('/', {
      me: superAdminMe,
      api: mockApi({ 'POST /v1/auth/session/logout': () => new Response(null, { status: 204 }) }),
    });
    await screen.findByRole('heading', { name: /welcome/i });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/auth/session/logout')).toHaveLength(1);
    expect(session.accessToken).toBeUndefined();
  });
});

describe('accepting an invitation', () => {
  it('A-15 sets a password with the link token and lands signed in', async () => {
    const api = mockApi({
      'POST /v1/auth/admin-invitations/accept': tokens(1),
      'POST /v1/auth/session/login': tokens(2),
      'GET /v1/admin/me': meWith(['bookings:read'], [], {
        email: 'new@rento.demo',
        displayName: 'New',
      }),
      'GET /v1/admin/dashboard': {
        generatedAt: '2030-01-01T00:00:00Z',
        windowDays: 7,
        now: { held: 0, confirmed: 0, active: 0, overdue: 0 },
        lastDays: {
          completed: 0,
          cancelled: 0,
          noShow: 0,
          expired: 0,
          grossPaise: 0,
          refundedPaise: 0,
        },
        upcoming: [],
      },
    });
    const { router } = renderApp('/accept-invitation?token=abcdefghijklmnopqrstuvwxyz', { api });
    await userEvent.type(await screen.findByLabelText('Your name'), 'New Person');
    await userEvent.type(screen.getByLabelText('Password'), 'a long enough password');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(api.callsTo('POST', '/v1/auth/admin-invitations/accept')[0]?.body).toEqual({
      token: 'abcdefghijklmnopqrstuvwxyz',
      password: 'a long enough password',
      name: 'New Person',
    });
    // The browser session (cookie) is started with the password just chosen.
    expect(api.callsTo('POST', '/v1/auth/session/login')[0]?.body).toEqual({
      email: 'owner@rento.demo',
      password: 'a long enough password',
    });
  });

  it('A-16 a weak password is explained next to the field and the link stays usable', async () => {
    const api = mockApi({
      'POST /v1/auth/admin-invitations/accept': problemResponse(
        422,
        'VALIDATION_FAILED',
        'Request validation failed',
        [{ field: 'password', message: 'is too common' }],
      ),
    });
    renderApp('/accept-invitation?token=abcdefghijklmnopqrstuvwxyz', { api });
    await userEvent.type(await screen.findByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('is too common')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
  });

  it('A-17 a dead link says so; a missing token explains what to do', async () => {
    const api = mockApi({
      'POST /v1/auth/admin-invitations/accept': problemResponse(
        422,
        'VALIDATION_FAILED',
        'Request validation failed',
        [{ field: 'token', message: 'is not valid' }],
      ),
    });
    const first = renderApp('/accept-invitation?token=abcdefghijklmnopqrstuvwxyz', { api });
    await userEvent.type(await screen.findByLabelText('Password'), 'a long enough password');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer valid/i);
    first.unmount();

    renderApp('/accept-invitation');
    expect(
      await screen.findByRole('heading', { name: /invitation link incomplete/i }),
    ).toBeInTheDocument();
  });
});
