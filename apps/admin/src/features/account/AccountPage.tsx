import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useRef, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import { useAuth } from '@/auth/auth-context';
import { ErrorNote, Loading, PageHeader } from '@/components/page';
import { Avatar, EmailState } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/controls';
import { PHOTO_TYPES } from '@/lib/media';
import { TwoStepCard } from './mfa';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // the API's limit for profile photos

/** "My account": the signed-in administrator's own name, photo and password. */
export function AccountPage() {
  const api = useApi();
  const profile = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => unwrap(await api.GET('/v1/me')),
  });
  return (
    <>
      <PageHeader
        title="My account"
        description="Your name, photo and password. Only you can change these."
      />
      {profile.isPending && <Loading />}
      {profile.isError && (
        <ErrorNote error={profile.error} onRetry={() => void profile.refetch()} />
      )}
      {profile.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PhotoCard
            name={profile.data.displayName ?? profile.data.email ?? ''}
            photo={profile.data.avatarUrl}
          />
          <ProfileCard
            name={profile.data.displayName ?? ''}
            phone={profile.data.phone ?? ''}
            email={profile.data.email}
            emailVerified={profile.data.emailVerified}
          />
          <TwoStepCard />
          <PasswordCard />
        </div>
      )}
    </>
  );
}

/** After a change: reload this page's data and the header's (name and photo next to the sign-out button). */
function useRefreshProfile() {
  const queryClient = useQueryClient();
  const { reload } = useAuth();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    await reload();
  };
}

function PhotoCard({ name, photo }: { name: string; photo: string | null | undefined }) {
  const api = useApi();
  const refresh = useRefreshProfile();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const upload = useMutation({
    mutationFn: async (file: File) =>
      unwrap(
        await api.POST('/v1/me/avatar', {
          body: file as never,
          bodySerializer: (body: unknown) => body as never,
          headers: { 'content-type': file.type },
        }),
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async () => unwrap(await api.DELETE('/v1/me/avatar')),
    onSuccess: refresh,
  });
  const busy = upload.isPending || remove.isPending;

  async function choose(files: FileList | null) {
    setProblem(undefined);
    const file = files?.[0];
    if (!file) return;
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
      setProblem('Only JPEG, PNG or WebP pictures can be uploaded.');
    } else if (file.size > MAX_AVATAR_BYTES) {
      setProblem('The picture is larger than 2 MB.');
    } else {
      try {
        await upload.mutateAsync(file);
      } catch {
        /* shown below */
      }
    }
    if (input.current) input.current.value = '';
  }

  return (
    <Card className="p-4">
      <h3 className="mb-1 font-medium">Photo</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Shown next to your name in this panel. JPEG, PNG or WebP, up to 2 MB.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} src={photo} size={80} />
        <div className="flex flex-col gap-2">
          <input
            ref={input}
            type="file"
            accept={PHOTO_TYPES.join(',')}
            className="sr-only"
            aria-label="Choose profile photo"
            onChange={(e) => void choose(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {upload.isPending ? 'Uploading…' : photo ? 'Change photo…' : 'Add photo…'}
          </Button>
          {photo && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => remove.mutate()}>
              Remove photo
            </Button>
          )}
        </div>
      </div>
      {problem && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {problem}
        </p>
      )}
      <ErrorNote error={upload.error ?? remove.error} />
    </Card>
  );
}

function ProfileCard({
  name: savedName,
  phone: savedPhone,
  email,
  emailVerified,
}: {
  name: string;
  phone: string;
  email: string | null | undefined;
  emailVerified: boolean;
}) {
  const api = useApi();
  const refresh = useRefreshProfile();
  const [name, setName] = useState(savedName);
  const [phone, setPhone] = useState(savedPhone);
  const [saved, setSaved] = useState(false);
  const changed = name.trim() !== savedName || phone.trim() !== savedPhone;
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.PATCH('/v1/me', {
          body: {
            ...(name.trim() !== savedName && { name: name.trim() }),
            ...(phone.trim() !== savedPhone && { phone: phone.trim() }),
          },
        }),
      ),
    onSuccess: async () => {
      setSaved(true);
      await refresh();
    },
  });
  const problems = fieldErrors(save.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    save.mutate();
  }

  return (
    <Card className="p-4">
      <h3 className="mb-1 font-medium">Details</h3>
      <form className="grid gap-3" onSubmit={submit} noValidate>
        <TextField
          label="Name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          error={problems['name']}
        />
        <TextField
          label="Phone"
          type="tel"
          value={phone}
          hint="With the country code, for example +919876543210."
          onChange={(e) => setPhone(e.target.value)}
          error={problems['phone']}
        />
        <div className="grid gap-1 text-sm">
          <span className="font-medium">Email</span>
          <span className="flex items-center gap-2">
            {email ?? '—'} <EmailState verified={emailVerified} />
            <span className="text-xs text-muted-foreground">
              {emailVerified ? 'Verified' : 'Not verified yet'}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            Your email is your sign-in name and cannot be changed here.
          </span>
        </div>
        <ErrorNote error={Object.keys(problems).length === 0 ? save.error : undefined} />
        {saved && !changed && (
          <p role="status" className="text-sm text-success">
            Details saved.
          </p>
        )}
        <div>
          <Button type="submit" disabled={!changed || save.isPending || name.trim().length === 0}>
            {save.isPending ? 'Saving…' : 'Save details'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const api = useApi();
  const { signOut } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [done, setDone] = useState(false);
  const mismatch = again.length > 0 && next !== again;
  const change = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/me/password', {
          body: { currentPassword: current, newPassword: next },
        }),
      ),
    onSuccess: () => setDone(true),
  });
  const problems = fieldErrors(change.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!mismatch) change.mutate();
  }

  if (done) {
    return (
      <Card className="p-4 lg:col-span-2">
        <h3 className="mb-1 font-medium">Password changed</h3>
        <p role="status" className="mb-3 text-sm">
          Your password was changed and every session was signed out, this one included. Sign in
          again with the new password.
        </p>
        <Button onClick={() => void signOut()}>Go to sign in</Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 lg:col-span-2">
      <h3 className="mb-1 font-medium">Password</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Changing it signs you out everywhere, and we email you a notice. A phrase of several words
        is best.
      </p>
      <form className="grid max-w-md gap-3" onSubmit={submit} noValidate>
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={problems['newPassword']}
        />
        <TextField
          label="New password again"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          error={mismatch ? 'The two passwords are different.' : undefined}
        />
        <ErrorNote error={Object.keys(problems).length === 0 ? change.error : undefined} />
        <div>
          <Button
            type="submit"
            disabled={
              change.isPending || current.length === 0 || next.length === 0 || again !== next
            }
          >
            {change.isPending ? 'Changing…' : 'Change password'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
