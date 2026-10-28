import { ImagePlus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { PHOTO_TYPES } from '@/lib/media';

/**
 * Where photos are added: a button that opens the file picker (several files at once) and a drop area for dragging
 * them in. It only hands the chosen files on; checking and uploading is up to the caller.
 */
export function PhotoDrop({
  onFiles,
  disabled,
  busyLabel,
  hint,
  single = false,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean | undefined;
  /** Shown instead of the prompt while something is uploading. */
  busyLabel?: string | undefined;
  hint?: string | undefined;
  /** One picture only (a banner), not several. */
  single?: boolean | undefined;
}) {
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = '';
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      data-testid="photo-drop"
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled) take(event.dataTransfer.files);
      }}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors',
        over ? 'border-primary bg-accent' : 'border-input bg-muted/40',
        disabled && 'opacity-60',
      )}
    >
      <ImagePlus aria-hidden="true" className="size-7 text-muted-foreground" />
      <input
        ref={input}
        type="file"
        accept={PHOTO_TYPES.join(',')}
        multiple={!single}
        className="sr-only"
        aria-label="Choose photos"
        aria-describedby={hintId}
        disabled={disabled}
        onChange={(event) => take(event.target.files)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:pointer-events-none"
      >
        {busyLabel ?? 'Add photos…'}
      </button>
      <p id={hintId} className="text-xs text-muted-foreground">
        {hint ??
          'Select several at once or drag them here. JPEG, PNG or WebP, up to 5 MB each, at most 10.'}
      </p>
    </div>
  );
}
