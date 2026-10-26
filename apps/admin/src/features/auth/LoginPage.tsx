import { type FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ApiError } from '@/api/errors';
import { ApiStatusBadge } from '@/app/AppLayout';
import { useAuth } from '@/auth/auth-context';
import { ErrorNote } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/controls';

/** Where to go after signing in: the page that sent the person here, if it was one of ours. */
const destination = (state: unknown): string => {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
};

export function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  if (status === 'authenticated') return <Navigate to={destination(location.state)} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await signIn(email.trim(), password);
      void navigate(destination(location.state), { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? new ApiError(401, caught.code, 'Incorrect email or password.')
          : caught,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-gradient-to-br from-[#f7a24b] to-[#ef8e30] p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between"
      >
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-24 size-[28rem] rounded-full bg-white/[0.07]" />
        <img src="/wordmark-white.png" alt="" className="relative h-12 w-auto self-start" />
        <div className="relative max-w-md">
          <p className="text-4xl leading-tight font-bold tracking-tight">
            Run every rental, from one place.
          </p>
          <p className="mt-4 text-lg opacity-80">
            Bookings, drawers, stock and your team — all in step.
          </p>
        </div>
      </section>
      <div className="flex flex-col items-center justify-center gap-6 p-6">
        <img
          src="/logo-512.png"
          alt=""
          aria-hidden="true"
          className="size-16 rounded-2xl shadow-card lg:hidden"
        />
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in to Rento Admin</CardTitle>
            <CardDescription>Staff access only.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
              <TextField
                label="Email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              {error !== undefined && <ErrorNote error={error} />}
              <Button type="submit" disabled={busy || email.trim() === '' || password === ''}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <ApiStatusBadge />
      </div>
    </main>
  );
}
