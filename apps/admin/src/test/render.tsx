import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { createAuthedClient } from '@/api/authed-client';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { SessionStore } from '@/auth/session';
import { type MockApi, mockApi } from './mock-api';

export { jsonResponse, problemResponse } from './mock-api';

export type AdminMe = {
  user: { id: string; email: string; displayName: string | null; avatarUrl: string | null };
  mfa: { required: boolean; enrolled: boolean; verified: boolean };
  superAdmin: boolean;
  permissions: string[];
  drawerScopes: Array<{ permission: string; drawerIds: string[] }>;
};

/** Every permission key — what a Super Admin's `/admin/me` lists. */
export const ALL_PERMISSIONS = [
  'inventory:read',
  'inventory:write',
  'assets:read',
  'assets:write',
  'assets:transfer',
  'drawers:read',
  'drawers:write',
  'bookings:read',
  'bookings:write',
  'bookings:cancel',
  'bookings:refund',
  'users:read',
  'users:write',
  'reports:read',
  'audit:read',
  'settings:read',
  'settings:write',
  'roles:read',
  'roles:manage',
  'admins:read',
  'admins:manage',
];

export const superAdminMe: AdminMe = {
  user: { id: 'u-boss', email: 'owner@rento.demo', displayName: 'Owner', avatarUrl: null },
  mfa: { required: false, enrolled: false, verified: false },
  superAdmin: true,
  permissions: ALL_PERMISSIONS,
  drawerScopes: [],
};

export const meWith = (
  permissions: string[],
  drawerScopes: AdminMe['drawerScopes'] = [],
  user: Partial<AdminMe['user']> = {},
): AdminMe => ({
  user: {
    id: 'u-staff',
    email: 'staff@rento.demo',
    displayName: 'Staff',
    avatarUrl: null,
    ...user,
  },
  mfa: { required: false, enrolled: false, verified: false },
  superAdmin: false,
  permissions,
  drawerScopes,
});

export const tokens = (n = 1) => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  tokenType: 'Bearer',
  expiresIn: 900,
  user: { id: 'u-boss', email: 'owner@rento.demo', displayName: 'Owner', emailVerified: true },
});

/** A `Storage` kept in memory, so tests never touch the real `sessionStorage`. */
export const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

export interface RenderOptions {
  api?: MockApi;
  /** Starts signed in as this administrator (the refresh cookie is waiting, like after a page reload). */
  me?: AdminMe | (() => AdminMe);
  session?: SessionStore;
}

/**
 * Renders the real route tree at `path` against a mock API. With `me`, the session is restored the way a reload does it:
 * refresh cookie → new access token → `/v1/admin/me`.
 */
export function renderApp(path: string, options: RenderOptions = {}) {
  const api = options.api ?? mockApi();
  const session = options.session ?? new SessionStore();
  if (options.me) {
    api.on('POST /v1/auth/session/refresh', () => tokens(1));
    api.on('GET /v1/admin/me', options.me);
  }
  api.on('GET /healthz', { status: 'ok' });

  const client = createAuthedClient('http://api.test', session, api.fetch);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <AppProviders client={client} session={session} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, router, api, session, queryClient };
}
