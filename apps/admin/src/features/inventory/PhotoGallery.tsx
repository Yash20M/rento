import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { unwrap } from '@/api/errors';
import type { ItemModel } from '@/api/types';
import { ErrorNote } from '@/components/page';
import { Button } from '@/components/ui/button';
import { MAX_PHOTO_BYTES, PHOTO_TYPES, mediaIdOf, photoUrl } from '@/lib/media';

/**
 * The pictures customers see for a product. The first one is the cover. Changes happen at once (they do not wait for
 * "Save"), because a photo is a file on the server, not a field of the form.
 */
export function PhotoGallery({ model }: { model: ItemModel }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>(model.photos);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  const adopt = async (updated: ItemModel) => {
    setPhotos(updated.photos);
    await queryClient.invalidateQueries({ queryKey: ['item-models'] });
  };

  const upload = useMutation({
    mutationFn: async (file: File) =>
      unwrap(
        await api.POST('/v1/admin/item-models/{id}/photos', {
          params: { path: { id: model.id } },
          body: file as never,
          bodySerializer: (body: unknown) => body as never,
          headers: { 'content-type': file.type },
        }),
      ),
    onSuccess: adopt,
  });
  const remove = useMutation({
    mutationFn: async (ref: string) => {
      const mediaId = mediaIdOf(ref);
      return mediaId
        ? unwrap(
            await api.DELETE('/v1/admin/item-models/{id}/photos/{mediaId}', {
              params: { path: { id: model.id, mediaId } },
            }),
          )
        : unwrap(
            await api.PATCH('/v1/admin/item-models/{id}', {
              params: { path: { id: model.id } },
              body: { photos: photos.filter((p) => p !== ref) },
            }),
          );
    },
    onSuccess: adopt,
  });
  const makeCover = useMutation({
    mutationFn: async (ref: string) =>
      unwrap(
        await api.PATCH('/v1/admin/item-models/{id}', {
          params: { path: { id: model.id } },
          body: { photos: [ref, ...photos.filter((p) => p !== ref)] },
        }),
      ),
    onSuccess: adopt,
  });
  const busy = upload.isPending || remove.isPending || makeCover.isPending;

  async function choose(files: FileList | null) {
    setProblem(undefined);
    for (const file of Array.from(files ?? [])) {
      if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
        setProblem(`${file.name}: only JPEG, PNG or WebP pictures can be uploaded.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setProblem(`${file.name}: the picture is larger than 5 MB.`);
        continue;
      }
      try {
        await upload.mutateAsync(file);
      } catch {
        return; // the error is shown below
      }
    }
    if (input.current) input.current.value = '';
  }

  return (
    <div className="grid gap-2 sm:col-span-2">
      <span className="text-sm font-medium">Photos</span>
      <p className="text-xs text-muted-foreground">
        Customers see these in the app; the first one is the cover. JPEG, PNG or WebP, up to 5 MB
        each, at most 10.
      </p>
      {photos.length > 0 && (
        <ul aria-label="Photos" className="flex flex-wrap gap-3">
          {photos.map((ref, index) => (
            <li key={ref} className="grid w-28 gap-1">
              <img
                src={photoUrl(ref)}
                alt={`${model.name} photo ${index + 1}`}
                className="h-24 w-28 rounded-md border object-cover"
              />
              <div className="flex gap-1">
                {index > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => makeCover.mutate(ref)}
                    aria-label={`Make photo ${index + 1} the cover`}
                  >
                    Cover
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => remove.mutate(ref)}
                  aria-label={`Remove photo ${index + 1}`}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div>
        <input
          ref={input}
          type="file"
          accept={PHOTO_TYPES.join(',')}
          multiple
          className="sr-only"
          aria-label="Choose photos"
          onChange={(e) => void choose(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || photos.length >= 10}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? 'Uploading…' : 'Add photos…'}
        </Button>
      </div>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <ErrorNote error={upload.error ?? remove.error ?? makeCover.error} />
    </div>
  );
}
