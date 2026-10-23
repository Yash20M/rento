import { X } from 'lucide-react';
import { type ReactNode, useEffect, useEffectEvent, useId, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Open dialogs, oldest first: Escape closes only the one on top (a question asked over a form leaves the form open). */
const open: symbol[] = [];

/**
 * A modal dialog: dimmed backdrop, focus moves in and returns on close, Escape closes. Built from a plain element with
 * `role="dialog"` rather than `<dialog>` so it behaves the same in every browser and in the test environment.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description?: string | undefined;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // The parent usually passes a fresh function every render; an effect event keeps the effect (and the focus handling)
  // from restarting while someone is typing.
  const close = useEffectEvent(() => onClose());

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const me = Symbol('modal');
    open.push(me);
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open[open.length - 1] === me) close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      open.splice(open.indexOf(me), 1);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'w-full rounded-xl border bg-card text-card-foreground shadow-lg outline-none',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b p-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" aria-hidden="true" />
          </Button>
        </header>
        <div className="p-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t p-4">{footer}</footer>}
      </div>
    </div>
  );
}
