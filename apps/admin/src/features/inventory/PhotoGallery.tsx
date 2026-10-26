import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { ApiError, unwrap } from '@/api/errors';
import type { ItemModel } from '@/api/types';
import { ErrorNote } from '@/components/page';
import { Button } from '@/components/ui/button';
import { MAX_PHOTOS, checkPhotos, mediaIdOf, photoUrl } from '@/lib/media';
import { PhotoDrop } from './PhotoDrop';

type Api = ReturnType<typeof useApi>;

/** Uploads one picture to a product (raw bytes, as the API expects) and returns the product with its new photo list. */
export async function uploadPhoto(api: Api, modelId: string, file: File): Promise<ItemModel> {
  return unwrap(
    await api.POST('/v1/admin/item-models/{id}/photos', {
      params: { path: { id: modelId } },
      body: file as never,
      bodySerializer: (body: unknown) => body as never,
      headers: { 'content-type': file.type },
    }),
  );
}

const reason = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'the upload failed';

/**
 * The pictures customers see for a product. The first one is the cover. Changes happen at once (they do not wait for
 * "Save"), because a photo is a file on the server, not a field of the form. Several files can be chosen or dropped
 * in one go; each is checked and uploaded in turn, and one that fails does not stop the others.
 */
export function PhotoGallery({ model }: { model: ItemModel }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<string[]>(model.photos);
  const [problems, setProblems] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | undefined>(undefined);
  const [result, setResult] = useState<string | undefined>(undefined);

  const adopt = async (updated: ItemModel) => {
    setPhotos(updated.photos);
    await queryClient.invalidateQueries({ queryKey: ['item-models'] });
  };

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
  const reorder = useMutation({
    mutationFn: async (next: string[]) =>
      unwrap(
        await api.PATCH('/v1/admin/item-models/{id}', {
          params: { path: { id: model.id } },
          body: { photos: next },
        }),
      ),
    onSuccess: adopt,
  });
  const uploading = progress !== undefined;
  const busy = uploading || remove.isPending || reorder.isPending;

  async function add(files: File[]) {
    setResult(undefined);
    const { accepted, problems: rejected } = checkPhotos(files, MAX_PHOTOS - photos.length);
    const failed = [...rejected];
    let stored = 0;
    setProblems(failed);
    for (const [index, file] of accepted.entries()) {
      setProgress({ done: index, total: accepted.length });
      try {
        await adopt(await uploadPhoto(api, model.id, file));
        stored += 1;
      } catch (error) {
        failed.push(`${file.name}: ${reason(error)}.`);
        setProblems([...failed]);
      }
    }
    setProgress(undefined);
    if (stored > 0) setResult(`${stored} photo${stored === 1 ? '' : 's'} added.`);
  }

  const move = (index: number, by: -1 | 1) => {
    const next = [...photos];
    const target = index + by;
    [next[index], next[target]] = [next[target] as string, next[index] as string];
    reorder.mutate(next);
  };

  return (
    <div className="grid gap-2 sm:col-span-2">
      <span className="text-sm font-medium">
        Photos{' '}
        <span className="font-normal text-muted-foreground">
          ({photos.length} of {MAX_PHOTOS})
        </span>
      </span>
      <p className="text-xs text-muted-foreground">
        Customers see these in the app; the first one is the cover.
      </p>
      {photos.length > 0 && (
        <ul aria-label="Photos" className="flex flex-wrap gap-3">
          {photos.map((ref, index) => (
            <li key={ref} className="grid w-36 gap-1">
              <div className="relative">
                <img
                  src={photoUrl(ref)}
                  alt={`${model.name} photo ${index + 1}`}
                  className="h-28 w-36 rounded-md border object-cover"
                />
                {index === 0 && (
                  <span className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Cover
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 px-0"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Move photo ${index + 1} earlier`}
                  title={`Move photo ${index + 1} earlier`}
                >
                  <ArrowLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 px-0"
                  disabled={busy || index === photos.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Move photo ${index + 1} later`}
                  title={`Move photo ${index + 1} later`}
                >
                  <ArrowRight className="size-3.5" />
                </Button>
                {index > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 px-0"
                    disabled={busy}
                    onClick={() => reorder.mutate([ref, ...photos.filter((p) => p !== ref)])}
                    aria-label={`Make photo ${index + 1} the cover`}
                    title={`Make photo ${index + 1} the cover`}
                  >
                    <Star className="size-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 px-0"
                  disabled={busy}
                  onClick={() => remove.mutate(ref)}
                  aria-label={`Remove photo ${index + 1}`}
                  title={`Remove photo ${index + 1}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <PhotoDrop
        onFiles={(files) => void add(files)}
        disabled={busy || photos.length >= MAX_PHOTOS}
        busyLabel={
          progress
            ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
            : undefined
        }
      />
      {result && (
        <p role="status" className="text-sm text-success">
          {result}
        </p>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="grid gap-0.5 text-sm text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <ErrorNote error={remove.error ?? reorder.error} />
    </div>
  );
}

/**
 * Pictures chosen while a NEW product is being filled in: kept here (with previews) and uploaded by the form right
 * after the product is saved, because a photo needs the product to exist first.
 */
export function PendingPhotos({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [problems, setProblems] = useState<string[]>([]);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  function add(chosen: File[]) {
    const { accepted, problems: rejected } = checkPhotos(chosen, MAX_PHOTOS - files.length);
    setProblems(rejected);
    if (accepted.length > 0) onChange([...files, ...accepted]);
  }

  return (
    <div className="grid gap-2 sm:col-span-2">
      <span className="text-sm font-medium">
        Photos{' '}
        <span className="font-normal text-muted-foreground">
          ({files.length} of {MAX_PHOTOS})
        </span>
      </span>
      <p className="text-xs text-muted-foreground">
        They are uploaded when you save the product. The first one is the cover.
      </p>
      {files.length > 0 && (
        <ul aria-label="Photos to upload" className="flex flex-wrap gap-3">
          {files.map((file, index) => (
            <li key={`${file.name}:${file.size}:${file.lastModified}`} className="grid w-36 gap-1">
              <div className="relative">
                <img
                  src={urls[index] as string}
                  alt={`Chosen photo ${index + 1}: ${file.name}`}
                  className="h-28 w-36 rounded-md border object-cover"
                />
                {index === 0 && (
                  <span className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Cover
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {index > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 px-0"
                    aria-label={`Make chosen photo ${index + 1} the cover`}
                    title={`Make chosen photo ${index + 1} the cover`}
                    onClick={() => onChange([file, ...files.filter((f) => f !== file)])}
                  >
                    <Star className="size-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 px-0"
                  aria-label={`Remove chosen photo ${index + 1}`}
                  title={`Remove chosen photo ${index + 1}`}
                  onClick={() => onChange(files.filter((f) => f !== file))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <PhotoDrop onFiles={add} disabled={files.length >= MAX_PHOTOS} />
      {problems.length > 0 && (
        <ul role="alert" className="grid gap-0.5 text-sm text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
