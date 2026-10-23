import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import { useAuth } from '@/auth/auth-context';
import { ErrorNote, Loading } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';

/** The six digits from the authenticator app, or (when the phone is lost) one recovery code. */
export function CodeForm({
  submitLabel,
  onVerified,
  autoFocus = false,
}: {
  submitLabel: string;
  onVerified: () => void | Promise<void>;
  autoFocus?: boolean;
}) {
  const api = useApi();
  const { adoptAccessToken } = useAuth();
  const [recovery, setRecovery] = useState(false);
  const [text, setText] = useState('');
  const verify = useMutation({
    mutationFn: async () => {
      const body = recovery ? { recoveryCode: text.trim() } : { code: text.replace(/\s/g, '') };
      const session = unwrap(await api.POST('/v1/auth/session/mfa/verify', { body }));
      await adoptAccessToken(session.accessToken);
    },
    onSuccess: () => onVerified(),
  });
  const problem = fieldErrors(verify.error)['code'];

  function submit(event: FormEvent) {
    event.preventDefault();
    verify.mutate();
  }

  return (
    <form className="grid gap-3" onSubmit={submit} noValidate>
      <TextField
        label={recovery ? 'Recovery code' : 'Code from your authenticator app'}
        name="mfa-code"
        inputMode={recovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        maxLength={recovery ? 24 : 7}
        value={text}
        onChange={(e) => setText(e.target.value)}
        error={problem}
        hint={
          recovery ? 'Each recovery code works once.' : 'Six digits. It changes every 30 seconds.'
        }
      />
      <ErrorNote error={problem ? undefined : verify.error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={verify.isPending || text.trim().length === 0}>
          {verify.isPending ? 'Checking…' : submitLabel}
        </Button>
        <button
          type="button"
          className="text-sm text-primary underline-offset-2 hover:underline"
          onClick={() => {
            setRecovery((value) => !value);
            setText('');
            verify.reset();
          }}
        >
          {recovery ? 'Use the app instead' : 'Lost your phone? Use a recovery code'}
        </button>
      </div>
    </form>
  );
}

/** Asks for a fresh code when a sensitive action needs one, then lets the action carry on. */
export function StepUpHost() {
  const { registerStepUp } = useAuth();
  const [waiting, setWaiting] = useState<((proved: boolean) => void) | undefined>(undefined);

  useEffect(
    () =>
      registerStepUp(
        () =>
          new Promise<boolean>((resolve) => {
            setWaiting(() => resolve);
          }),
      ),
    [registerStepUp],
  );

  if (!waiting) return null;
  const finish = (proved: boolean) => {
    waiting(proved);
    setWaiting(undefined);
  };
  return (
    <Modal
      title="Confirm it is you"
      description="This action needs a fresh code from your authenticator app."
      onClose={() => finish(false)}
    >
      <CodeForm submitLabel="Confirm" onVerified={() => finish(true)} autoFocus />
    </Modal>
  );
}

/** Setting it up: password → scan the code → type the first code → keep the recovery codes. */
export function EnrolWizard({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const api = useApi();
  const { adoptAccessToken } = useAuth();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState<{ secret: string; otpauthUri: string } | undefined>(
    undefined,
  );
  const [codes, setCodes] = useState<string[] | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  const begin = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/auth/session/mfa/enrol', {
          body: password === '' ? {} : { password },
        }),
      ),
    onSuccess: setSecret,
  });
  const confirm = useMutation({
    mutationFn: async () => {
      const done = unwrap(
        await api.POST('/v1/auth/session/mfa/enrol/confirm', {
          body: { code: code.replace(/\s/g, '') },
        }),
      );
      await adoptAccessToken(done.accessToken);
      return done.recoveryCodes;
    },
    onSuccess: setCodes,
  });

  if (codes) {
    return (
      <div className="grid gap-3">
        <p role="status" className="text-sm font-medium text-success">
          Two-step verification is on.
        </p>
        <p className="text-sm">
          Save these recovery codes somewhere safe. Each one works once if you lose your phone.{' '}
          <strong>They are shown only now.</strong>
        </p>
        <ul
          aria-label="Recovery codes"
          className="grid grid-cols-2 gap-1 rounded-md border bg-muted/40 p-3 font-mono text-sm"
        >
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}
          >
            Copy
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const link = document.createElement('a');
              link.href = URL.createObjectURL(
                new Blob([`Rento recovery codes\n\n${codes.join('\n')}\n`], { type: 'text/plain' }),
              );
              link.download = 'rento-recovery-codes.txt';
              link.click();
              URL.revokeObjectURL(link.href);
            }}
          >
            Download
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
          />
          I have saved my recovery codes
        </label>
        <div>
          <Button type="button" disabled={!saved} onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (secret) {
    return (
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          confirm.mutate();
        }}
        noValidate
      >
        <p className="text-sm">
          Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password …) and
          scan this code — or type the key in by hand.
        </p>
        <QrImage text={secret.otpauthUri} />
        <p className="text-sm">
          Key: <code className="break-all font-mono">{secret.secret}</code>
        </p>
        <TextField
          label="First code from the app"
          name="mfa-first-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={fieldErrors(confirm.error)['code']}
        />
        <ErrorNote error={fieldErrors(confirm.error)['code'] ? undefined : confirm.error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={confirm.isPending || code.trim().length === 0}>
            {confirm.isPending ? 'Checking…' : 'Turn on'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form
      className="grid max-w-md gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        begin.mutate();
      }}
      noValidate
    >
      <p className="text-sm">
        Administrators sign in with a code from an authenticator app as well as a password. First,
        confirm it is you.
      </p>
      <TextField
        label="Your password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <ErrorNote error={begin.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={begin.isPending}>
          {begin.isPending ? 'Starting…' : 'Continue'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function QrImage({ text }: { text: string }) {
  const [source, setSource] = useState<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(text, { margin: 1, width: 192 }).then((url) => {
      if (live) setSource(url);
    });
    return () => {
      live = false;
    };
  }, [text]);
  if (!source) return <Loading label="Preparing the code…" />;
  return (
    <img
      src={source}
      alt="QR code to scan with your authenticator app"
      width={192}
      height={192}
      className="rounded-md border bg-white"
    />
  );
}

/** Shown instead of the whole panel while the second step is required and this session has not passed it. */
export function MfaGate({ enrolled }: { enrolled: boolean }) {
  const { signOut, reload } = useAuth();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <Card className="p-5">
        <h1 className="mb-1 text-xl font-semibold">
          {enrolled ? 'Two-step verification' : 'Set up two-step verification'}
        </h1>
        {enrolled ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Enter the code from your authenticator app to open the admin panel.
            </p>
            <CodeForm submitLabel="Verify" onVerified={() => reload()} autoFocus />
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Administrators must use an authenticator app. It takes a minute.
            </p>
            <EnrolWizard onDone={() => void reload()} />
          </>
        )}
      </Card>
      <div className="text-center">
        <Button variant="outline" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </main>
  );
}

/** "My account" card: the state of two-step verification, new recovery codes, turning it off. */
export function TwoStepCard() {
  const api = useApi();
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['mfa-status'],
    queryFn: async () => unwrap(await api.GET('/v1/auth/session/mfa')),
  });
  const [mode, setMode] = useState<'idle' | 'enrol' | 'codes' | 'off'>('idle');
  const required = me?.mfa.required ?? false;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['mfa-status'] });

  return (
    <Card className="p-4 lg:col-span-2">
      <h3 className="mb-1 font-medium">Two-step verification</h3>
      {status.isPending && <Loading />}
      {status.isError && <ErrorNote error={status.error} onRetry={() => void status.refetch()} />}
      {status.data && mode === 'idle' && (
        <div className="grid gap-3">
          <p className="text-sm" data-testid="mfa-state">
            {status.data.enrolled
              ? `On. ${status.data.recoveryCodesLeft} recovery code${status.data.recoveryCodesLeft === 1 ? '' : 's'} left.`
              : 'Off. Add an authenticator app so a stolen password is not enough.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {!status.data.enrolled && <Button onClick={() => setMode('enrol')}>Set up</Button>}
            {status.data.enrolled && (
              <Button variant="outline" onClick={() => setMode('codes')}>
                New recovery codes…
              </Button>
            )}
            {status.data.enrolled && !required && (
              <Button variant="outline" onClick={() => setMode('off')}>
                Turn off…
              </Button>
            )}
          </div>
          {status.data.enrolled && required && (
            <p className="text-xs text-muted-foreground">
              It is required for administrators, so it cannot be turned off. Lost your phone? Ask
              another administrator to reset it for you.
            </p>
          )}
        </div>
      )}
      {mode === 'enrol' && (
        <EnrolWizard
          onCancel={() => setMode('idle')}
          onDone={() => {
            setMode('idle');
            void refresh();
          }}
        />
      )}
      {(mode === 'codes' || mode === 'off') && (
        <ProofForm
          kind={mode}
          onCancel={() => setMode('idle')}
          onDone={() => {
            setMode('idle');
            void refresh();
          }}
        />
      )}
    </Card>
  );
}

/** Password and a current code, for the two things that need both. */
function ProofForm({
  kind,
  onDone,
  onCancel,
}: {
  kind: 'codes' | 'off';
  onDone: () => void;
  onCancel: () => void;
}) {
  const api = useApi();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | undefined>(undefined);
  const run = useMutation({
    mutationFn: async () => {
      const body = { code: code.replace(/\s/g, ''), ...(password !== '' && { password }) };
      if (kind === 'off') {
        unwrap(await api.POST('/v1/auth/session/mfa/disable', { body }));
        return undefined;
      }
      return unwrap(await api.POST('/v1/auth/session/mfa/recovery-codes', { body })).recoveryCodes;
    },
    onSuccess: (result) => (result ? setCodes(result) : onDone()),
  });
  const problems = fieldErrors(run.error);
  const first = useRef<HTMLDivElement>(null);

  if (codes) {
    return (
      <div className="grid gap-3" ref={first}>
        <p className="text-sm">
          New recovery codes. The old ones no longer work. <strong>Shown only now.</strong>
        </p>
        <ul
          aria-label="Recovery codes"
          className="grid grid-cols-2 gap-1 rounded-md border bg-muted/40 p-3 font-mono text-sm"
        >
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div>
          <Button onClick={onDone}>I have saved them</Button>
        </div>
      </div>
    );
  }
  return (
    <form
      className="grid max-w-md gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        run.mutate();
      }}
      noValidate
    >
      <TextField
        label="Your password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        label="Code from your authenticator app"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={problems['code']}
      />
      <ErrorNote error={problems['code'] ? undefined : run.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={run.isPending || code.trim().length === 0}>
          {kind === 'off' ? 'Turn off' : 'Get new codes'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
