import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { unwrap } from '@/api/errors';
import type { Drawer } from '@/api/types';
import { ErrorNote } from '@/components/page';
import { Button } from '@/components/ui/button';
import { MAX_PHOTO_BYTES, PHOTO_TYPES, photoUrl } from '@/lib/media';

/**
 * The cover photo customers see on the drawer's card in the app. Changes happen at once (they do not wait for
 * "Save"), because a photo is a file on the server, not a field of the form.
 */
export function DrawerPhoto({ drawer }: { drawer: Drawer }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(drawer.photoUrl);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  // A new picture has the same address pattern but a new id; the list is refreshed so cards show it too.
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['drawers'] });
    const fresh = unwrap(
      await api.GET('/v1/admin/drawers/{id}', { params: { path: { id: drawer.id } } }),
    );
    setPhoto(fresh.photoUrl);
  };

  const upload = useMutation({
    mutationFn: async (file: File) =>
      unwrap(
        await api.POST('/v1/admin/drawers/{id}/photo', {
          params: { path: { id: drawer.id } },
          body: file as never,
          bodySerializer: (body: unknown) => body as never,
          headers: { 'content-type': file.type },
        }),
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.DELETE('/v1/admin/drawers/{id}/photo', { params: { path: { id: drawer.id } } }),
      ),
    onSuccess: refresh,
  });
  const busy = upload.isPending || remove.isPending;

  async function choose(files: FileList | null) {
    setProblem(undefined);
    const file = files?.[0];
    if (!file) return;
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
      setProblem('Only JPEG, PNG or WebP pictures can be uploaded.');
    } else if (file.size > MAX_PHOTO_BYTES) {
      setProblem('The picture is larger than 5 MB.');
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
    <div className="grid gap-2 sm:col-span-2">
      <span className="text-sm font-medium">Cover photo</span>
      <p className="text-xs text-muted-foreground">
        Shown on the drawer's card in the app. JPEG, PNG or WebP, up to 5 MB. Without one the app
        shows a coloured cover.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {photo ? (
          <img
            src={photoUrl(photo)}
            alt={`${drawer.name} cover`}
            className="h-24 w-40 rounded-xl border object-cover"
          />
        ) : (
          <div
            aria-label="No cover photo"
            role="img"
            className="grid h-24 w-40 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xs text-white"
          >
            No photo yet
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={input}
            type="file"
            accept={PHOTO_TYPES.join(',')}
            className="sr-only"
            aria-label="Choose cover photo"
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
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <ErrorNote error={upload.error ?? remove.error} />
    </div>
  );
}
