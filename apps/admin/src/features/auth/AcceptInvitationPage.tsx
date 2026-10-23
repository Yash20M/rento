import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import { useAuth } from '@/auth/auth-context';
import { ErrorNote } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/controls';

/** Public page behind the link in the invitation email: the invitee chooses a password and is signed in. */
export function AcceptInvitationPage() {
  const api = useApi();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const tokens = unwrap(
        await api.POST('/v1/auth/admin-invitations/accept', {
          body: { token, password, ...(name.trim() !== '' && { name: name.trim() }) },
        }),
      );
      // The invitation signs the person in without a cookie; start a proper browser session with the new password.
      await signIn(tokens.user.email ?? '', password);
      void navigate('/', { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const problems = fieldErrors(error);

  if (token === '') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invitation link incomplete</CardTitle>
            <CardDescription>
              Open the link from your invitation email, or ask an administrator to invite you again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm underline" to="/login">
              Go to sign in
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Accept your invitation</CardTitle>
          <CardDescription>Choose a password to create your Rento Admin account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
            <TextField
              label="Your name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              hint="At least 10 characters."
              error={problems['password']}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error !== undefined && problems['password'] === undefined && (
              <ErrorNote
                error={
                  problems['token'] !== undefined
                    ? 'This invitation link is no longer valid. Ask for a new one.'
                    : error
                }
              />
            )}
            <Button type="submit" disabled={busy || password === ''}>
              {busy ? 'Creating your account…' : 'Create account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
