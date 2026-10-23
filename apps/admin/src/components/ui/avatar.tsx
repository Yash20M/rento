import { BadgeCheck, MailCheck, MailQuestion } from 'lucide-react';
import { useState } from 'react';
import { photoUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

/** A person: their photo when they have one (and it loads), otherwise the first letter on a brand gradient. */
export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const letter = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <span
      data-testid="avatar"
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 font-semibold text-white',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {src && !broken ? (
        <img
          src={photoUrl(src)}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden="true">{letter}</span>
      )}
    </span>
  );
}

/** The blue tick of a verified identity, with a spoken name. */
export function VerifiedTick({ label = 'Identity verified' }: { label?: string }) {
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex text-sky-600">
      <BadgeCheck className="size-4" aria-hidden="true" />
    </span>
  );
}

/** Email verified (a tick) or not yet (a question mark), with a spoken name. */
export function EmailState({ verified }: { verified: boolean }) {
  const label = verified ? 'Email verified' : 'Email not verified';
  const Icon = verified ? MailCheck : MailQuestion;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('inline-flex', verified ? 'text-emerald-700' : 'text-muted-foreground')}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}

/** A small rounded cover of a place: its photo, or the first letter on a gradient. */
export function CoverThumb({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null | undefined;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      data-testid="cover-thumb"
      className={cn(
        'inline-grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-semibold text-white',
        className,
      )}
    >
      {src && !broken ? (
        <img
          src={photoUrl(src)}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden="true">{(name.trim()[0] ?? '?').toUpperCase()}</span>
      )}
    </span>
  );
}
