import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import { Loading } from '@/components/page';
import { MfaGate } from '@/features/account/mfa';

/** Everything below needs a signed-in administrator; anyone else is sent to the sign-in page and back afterwards. */
export function RequireAuth() {
  const { status, me } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loading label="Restoring your session…" />
      </main>
    );
  }
  if (status === 'anonymous') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }
  // While two-step verification is required, a session that has not passed it sees only the way to do so.
  if (me?.mfa.required && !me.mfa.verified) return <MfaGate enrolled={me.mfa.enrolled} />;
  return <Outlet />;
}

/**
 * Hides a page from people who lack the permission. This is a convenience — the API refuses the calls anyway
 * (README §13.5) — so there is no way to "unlock" anything by editing the browser.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div role="alert" className="rounded-lg border p-8 text-center">
        <h2 className="text-lg font-semibold">You do not have access to this page</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask an administrator to give your role the “{permission}” permission.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
