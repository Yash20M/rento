import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import type { Promotion } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { ConfirmDialog, EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Badge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Select, TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { formatWhen, fromLocalInput, toLocalInput } from '@/lib/format';
import { MAX_PHOTO_BYTES, PHOTO_TYPES, photoUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { useItemModels } from './ItemModelsPage';
import { PhotoDrop } from './PhotoDrop';

const THEMES = [
  { value: 'orange', label: 'Orange', color: '#EF8E30', ink: '#1F1408' },
  { value: 'ink', label: 'Dark', color: '#2A1F14', ink: '#FFF6EC' },
  { value: 'teal', label: 'Teal', color: '#0F766E', ink: '#F0FFFB' },
  { value: 'plum', label: 'Plum', color: '#6D28D9', ink: '#F7F0FF' },
] as const;
const themeOf = (value: string) => THEMES.find((t) => t.value === value) ?? THEMES[0];

const STATE: Record<string, { label: string; tone: Tone }> = {
  live: { label: 'Live', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  ended: { label: 'Ended', tone: 'neutral' },
  off: { label: 'Off', tone: 'neutral' },
};

export function usePromotions() {
  const api = useApi();
  const { can } = useAuth();
  return useQuery({
    queryKey: ['promotions'],
    enabled: can('inventory:read'),
    queryFn: async () => unwrap(await api.GET('/v1/admin/promotions')),
  });
}

/** How a banner will look to customers: the picture (or the colour), the title, the subtitle and the button. */
export function BannerPreview({
  title,
  subtitle,
  ctaLabel,
  theme,
  imageUrl,
  className,
  textless = false,
}: {
  title: string;
  subtitle?: string | null | undefined;
  ctaLabel?: string | null | undefined;
  theme: string;
  imageUrl?: string | null | undefined;
  className?: string;
  /** A thumbnail: only the picture or the colour, no words. */
  textless?: boolean;
}) {
  const t = themeOf(theme);
  return (
    <div
      aria-hidden="true"
      className={cn('relative overflow-hidden rounded-xl', className)}
      style={{ backgroundColor: t.color, color: t.ink }}
    >
      {imageUrl && (
        <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      {imageUrl && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 to-transparent" />
      )}
      <div
        className="relative flex h-full min-h-24 flex-col justify-end gap-0.5 p-3"
        style={imageUrl ? { color: '#fff' } : undefined}
      >
        {!textless && <p className="text-sm leading-tight font-bold">{title || 'Banner title'}</p>}
        {!textless && subtitle && <p className="text-xs opacity-85">{subtitle}</p>}
        {!textless && ctaLabel && (
          <span
            className="mt-1 w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{
              backgroundColor: imageUrl ? '#fff' : t.ink,
              color: imageUrl ? '#1F1408' : t.color,
            }}
          >
            {ctaLabel}
          </span>
        )}
      </div>
    </div>
  );
}

const schedule = (p: Promotion): string =>
  p.startsAt && p.endsAt
    ? `${formatWhen(p.startsAt)} → ${formatWhen(p.endsAt)}`
    : p.startsAt
      ? `From ${formatWhen(p.startsAt)}`
      : p.endsAt
        ? `Until ${formatWhen(p.endsAt)}`
        : 'Always';

export function PromotionsPage() {
  const { can } = useAuth();
  const writable = can('inventory:write');
  const api = useApi();
  const queryClient = useQueryClient();
  const promotions = usePromotions();
  const [editing, setEditing] = useState<Promotion | 'new' | undefined>(undefined);
  const [deleting, setDeleting] = useState<Promotion | undefined>(undefined);

  const toggle = useMutation({
    mutationFn: async (p: Promotion) =>
      unwrap(
        await api.PATCH('/v1/admin/promotions/{id}', {
          params: { path: { id: p.id } },
          body: { active: !p.active } as never,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  });

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Offers & banners"
        description="The banners on the customer app's home screen. Discounts on a product are set on the product itself (Item models)."
        actions={writable && <Button onClick={() => setEditing('new')}>New banner</Button>}
      />
      {promotions.isPending && <Loading />}
      {promotions.isError && (
        <ErrorNote error={promotions.error} onRetry={() => void promotions.refetch()} />
      )}
      <ErrorNote error={toggle.error} />
      {promotions.isSuccess && promotions.data.length === 0 && (
        <EmptyState
          title="No banners yet"
          hint="A banner announces an offer or something new. Add one and it appears on the home screen of the app."
        />
      )}
      {promotions.isSuccess && promotions.data.length > 0 && (
        <Table aria-label="Banners">
          <THead>
            <Tr>
              <Th>Banner</Th>
              <Th>Opens</Th>
              <Th>When</Th>
              <Th>Status</Th>
              <Th className="text-right">Order</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {promotions.data.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <BannerPreview
                      title={p.title}
                      subtitle={null}
                      theme={p.theme}
                      imageUrl={p.imageUrl ? photoUrl(p.imageUrl) : null}
                      textless
                      className="h-14 w-24 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-medium">{p.title}</div>
                      {p.subtitle && (
                        <div className="max-w-xs truncate text-xs text-muted-foreground">
                          {p.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                </Td>
                <Td>{p.itemModelName ?? <span className="text-muted-foreground">Nothing</span>}</Td>
                <Td className="text-sm">{schedule(p)}</Td>
                <Td>
                  <Badge tone={STATE[p.state]?.tone ?? 'neutral'}>
                    {STATE[p.state]?.label ?? p.state}
                  </Badge>
                </Td>
                <Td className="text-right tabular-nums">{p.sortOrder}</Td>
                <Td className="text-right">
                  {writable && (
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate(p)}
                        aria-label={`${p.active ? 'Turn off' : 'Turn on'} ${p.title}`}
                      >
                        {p.active ? 'Turn off' : 'Turn on'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleting(p)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      {editing && (
        <PromotionForm
          promotion={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {deleting && <DeletePromotion promotion={deleting} onClose={() => setDeleting(undefined)} />}
    </div>
  );
}

const trimmed = (s: string): string | null => (s.trim() === '' ? null : s.trim());

function PromotionForm({
  promotion,
  onClose,
}: {
  promotion: Promotion | undefined;
  onClose: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const products = useItemModels();
  const [title, setTitle] = useState(promotion?.title ?? '');
  const [subtitle, setSubtitle] = useState(promotion?.subtitle ?? '');
  const [ctaLabel, setCtaLabel] = useState(promotion?.ctaLabel ?? '');
  const [theme, setTheme] = useState<string>(promotion?.theme ?? 'orange');
  const [itemModelId, setItemModelId] = useState(promotion?.itemModelId ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(promotion?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(promotion?.endsAt));
  const [sortOrder, setSortOrder] = useState(String(promotion?.sortOrder ?? 0));
  const [active, setActive] = useState(promotion?.active ?? true);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  // The picture: chosen here for a NEW banner (uploaded right after it is saved); changed at once for an existing one.
  const [chosen, setChosen] = useState<File | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState<string | null>(promotion?.imageUrl ?? null);
  const [imageProblem, setImageProblem] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState<Promotion | undefined>(undefined);
  const current = promotion ?? saved;
  const chosenUrl = useMemo(() => (chosen ? URL.createObjectURL(chosen) : null), [chosen]);
  useEffect(() => () => (chosenUrl ? URL.revokeObjectURL(chosenUrl) : undefined), [chosenUrl]);

  const putImage = async (id: string, file: File): Promise<Promotion> =>
    unwrap(
      await api.POST('/v1/admin/promotions/{id}/image', {
        params: { path: { id } },
        body: file as never,
        bodySerializer: (body: unknown) => body as never,
        headers: { 'content-type': file.type },
      }),
    );

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      current
        ? unwrap(
            await api.PATCH('/v1/admin/promotions/{id}', {
              params: { path: { id: current.id } },
              body: body as never,
            }),
          )
        : unwrap(await api.POST('/v1/admin/promotions', { body: body as never })),
    onSuccess: async (result) => {
      if (!current && chosen) {
        try {
          await putImage(result.id, chosen);
        } catch {
          await queryClient.invalidateQueries({ queryKey: ['promotions'] });
          setSaved(result);
          setChosen(undefined);
          setImageProblem(
            'The banner was saved, but its picture could not be uploaded. Add it again below.',
          );
          return;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['promotions'] });
      onClose();
    },
  });
  const replaceImage = useMutation({
    mutationFn: async (file: File) => putImage(current!.id, file),
    onSuccess: async (p) => {
      setImageUrl(p.imageUrl);
      setImageProblem(undefined);
      await queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });
  const removeImage = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.DELETE('/v1/admin/promotions/{id}/image', {
          params: { path: { id: current!.id } },
        }),
      ),
    onSuccess: async () => {
      setImageUrl(null);
      await queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });
  const server = fieldErrors(save.error);
  const problems = { ...server, ...localErrors };

  function pick(files: File[]) {
    const file = files[0];
    if (!file) return;
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
      setImageProblem(`${file.name}: only JPEG, PNG or WebP pictures can be used.`);
      return;
    }
    if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
      setImageProblem(
        `${file.name}: ${file.size === 0 ? 'the file is empty' : 'the picture is larger than 5 MB'}.`,
      );
      return;
    }
    setImageProblem(undefined);
    if (current) replaceImage.mutate(file);
    else setChosen(file);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (title.trim() === '') errors['title'] = 'Enter a title.';
    else if (title.trim().length > 80) errors['title'] = 'Use at most 80 characters.';
    if (subtitle.trim().length > 160) errors['subtitle'] = 'Use at most 160 characters.';
    if (ctaLabel.trim().length > 30) errors['ctaLabel'] = 'Use at most 30 characters.';
    const order = /^\d{1,5}$/.test(sortOrder.trim()) ? Number(sortOrder.trim()) : undefined;
    if (order === undefined || order > 10_000)
      errors['sortOrder'] = 'Enter a whole number from 0 to 10000.';
    const starts = fromLocalInput(startsAt);
    const ends = fromLocalInput(endsAt);
    if (starts === undefined) errors['startsAt'] = 'Enter a valid date and time.';
    if (ends === undefined) errors['endsAt'] = 'Enter a valid date and time.';
    if (starts && ends && ends <= starts) errors['endsAt'] = 'Must be after the start.';
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) return;
    save.mutate({
      title: title.trim(),
      subtitle: trimmed(subtitle),
      ctaLabel: trimmed(ctaLabel),
      theme,
      itemModelId: itemModelId === '' ? null : itemModelId,
      startsAt: starts ?? null,
      endsAt: ends ?? null,
      sortOrder: order,
      active,
    });
  }

  const shownImage = chosenUrl ?? (imageUrl ? photoUrl(imageUrl) : null);
  const busy = save.isPending || replaceImage.isPending || removeImage.isPending;

  return (
    <Modal
      title={promotion ? `Edit ${promotion.title}` : 'New banner'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="promotion-form" disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="promotion-form" className="grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Preview</p>
          <BannerPreview
            title={title.trim()}
            subtitle={trimmed(subtitle)}
            ctaLabel={trimmed(ctaLabel)}
            theme={theme}
            imageUrl={shownImage}
            className="h-36 w-full max-w-md"
          />
        </div>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={problems['title']}
          className="sm:col-span-2"
          maxLength={200}
        />
        <TextField
          label="Subtitle"
          hint="One short line under the title."
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          error={problems['subtitle']}
          className="sm:col-span-2"
        />
        <TextField
          label="Button label"
          hint="For example “Shop now”. Empty: no button."
          value={ctaLabel}
          onChange={(e) => setCtaLabel(e.target.value)}
          error={problems['ctaLabel']}
        />
        <Field label="Colour" hint="Used when the banner has no picture." error={problems['theme']}>
          {(aria) => (
            <Select {...aria} value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Opens this product"
          hint="Tapping the banner opens it. Empty: the banner is just an announcement."
          error={problems['itemModelId']}
          className="sm:col-span-2"
        >
          {(aria) => (
            <Select {...aria} value={itemModelId} onChange={(e) => setItemModelId(e.target.value)}>
              <option value="">Nothing</option>
              {(products.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.status === 'inactive' ? ' (inactive)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <TextField
          label="Shows from"
          type="datetime-local"
          hint="Empty: at once. Your local time."
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          error={problems['startsAt']}
        />
        <TextField
          label="Shows until"
          type="datetime-local"
          hint="Empty: until you turn it off."
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          error={problems['endsAt']}
        />
        <TextField
          label="Order"
          inputMode="numeric"
          hint="Lower numbers come first."
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          error={problems['sortOrder']}
        />
        <div className="flex items-center">
          <Checkbox
            label="Shown to customers (switch off to hide it)"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <span className="text-sm font-medium">Picture</span>
          <p className="text-xs text-muted-foreground">
            Wide pictures work best (about 2:1). JPEG, PNG or WebP, up to 5 MB.
            {!current && ' It is uploaded when you save.'}
          </p>
          <PhotoDrop
            single
            onFiles={pick}
            disabled={busy}
            busyLabel={
              replaceImage.isPending
                ? 'Uploading…'
                : shownImage
                  ? 'Replace picture…'
                  : 'Add picture…'
            }
            hint="Choose a file or drag it here."
          />
          {shownImage && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => (chosen ? setChosen(undefined) : removeImage.mutate())}
              >
                Remove picture
              </Button>
            </div>
          )}
          {imageProblem && (
            <p role="alert" className="text-sm text-destructive">
              {imageProblem}
            </p>
          )}
          <ErrorNote error={replaceImage.error ?? removeImage.error} />
        </div>
        <ErrorNote
          className="sm:col-span-2"
          error={save.error && Object.keys(server).length === 0 ? save.error : undefined}
        />
      </form>
    </Modal>
  );
}

function DeletePromotion({ promotion, onClose }: { promotion: Promotion; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.DELETE('/v1/admin/promotions/{id}', { params: { path: { id: promotion.id } } }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['promotions'] });
      onClose();
    },
  });
  return (
    <ConfirmDialog
      title="Delete banner?"
      message={
        <>
          “{promotion.title}” and its picture will be removed from the app. To hide it for a while,
          turn it off instead.
        </>
      }
      confirmLabel="Delete"
      destructive
      busy={remove.isPending}
      error={remove.error}
      onConfirm={() => remove.mutate()}
      onClose={onClose}
    />
  );
}
