import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { drawerA } from '@/test/fixtures';
import { mockApi } from '@/test/mock-api';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

/** P3-46 — the cover photo of a drawer: shown, changed and removed at once, with the same checks as product photos. */
const MEDIA = '/v1/media/33333333-3333-4333-8333-333333333333';
const png = (size = 20, type = 'image/png') =>
  new File([new Uint8Array(size)], 'cover.png', { type });
const user = userEvent.setup({ applyAccept: false });

const setup = (photoUrl: string | null, extra: Record<string, unknown> = {}, me = superAdminMe) => {
  const api = mockApi({
    'GET /v1/admin/drawers': [{ ...drawerA, photoUrl }],
    'GET /v1/admin/drawers/:id': { ...drawerA, photoUrl },
    ...extra,
  } as never);
  renderApp('/drawers', { me, api });
  return api;
};
const openEditor = async () => {
  const table = await screen.findByRole('table');
  await userEvent.click(
    within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: 'Edit' }),
  );
  return within(await screen.findByRole('dialog'));
};

describe('drawer cover photo', () => {
  it('P-01 shows the current cover, or says there is none', async () => {
    setup(MEDIA);
    const dialog = await openEditor();
    expect(dialog.getByRole('img', { name: /cover/i }).getAttribute('src')).toBe(MEDIA);
    expect(dialog.getByRole('button', { name: 'Change photo…' })).toBeInTheDocument();
  });

  it('P-02 without a cover: a placeholder and "Add photo…", no "Remove"', async () => {
    setup(null);
    const dialog = await openEditor();
    expect(dialog.getByRole('img', { name: 'No cover photo' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Add photo…' })).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();
  });

  it('P-03 choosing a file sends it as the body with its own type, and the new cover shows', async () => {
    let photo: string | null = null;
    const api = mockApi({
      'GET /v1/admin/drawers': () => [{ ...drawerA, photoUrl: photo }],
      'GET /v1/admin/drawers/:id': () => ({ ...drawerA, photoUrl: photo }),
      'POST /v1/admin/drawers/:id/photo': () => {
        photo = MEDIA;
        return new Response(null, { status: 204 });
      },
    } as never);
    renderApp('/drawers', { me: superAdminMe, api });
    const dialog = await openEditor();
    await user.upload(dialog.getByLabelText('Choose cover photo'), png());
    await waitFor(() => expect(dialog.getByRole('img', { name: /cover$/i })).toBeInTheDocument());
    const call = api.calls.find((c) => c.method === 'POST' && c.path.endsWith('/photo'))!;
    expect(call.path).toBe('/v1/admin/drawers/d-1/photo');
    expect(call.headers.get('content-type')).toBe('image/png');
  });

  it('P-04 only pictures: another type or a file over 5 MB is refused before anything is sent', async () => {
    const api = setup(null);
    const dialog = await openEditor();
    await user.upload(dialog.getByLabelText('Choose cover photo'), png(10, 'application/pdf'));
    expect(await dialog.findByRole('alert')).toHaveTextContent(/only JPEG, PNG or WebP/i);
    await user.upload(dialog.getByLabelText('Choose cover photo'), png(5 * 1024 * 1024 + 1));
    expect(await dialog.findByRole('alert')).toHaveTextContent(/larger than 5 MB/i);
    expect(api.calls.some((c) => c.method === 'POST' && c.path.endsWith('/photo'))).toBe(false);
  });

  it('P-05 removing asks the server and goes back to the placeholder', async () => {
    let photo: string | null = MEDIA;
    const api = mockApi({
      'GET /v1/admin/drawers': () => [{ ...drawerA, photoUrl: photo }],
      'GET /v1/admin/drawers/:id': () => ({ ...drawerA, photoUrl: photo }),
      'DELETE /v1/admin/drawers/:id/photo': () => {
        photo = null;
        return new Response(null, { status: 204 });
      },
    } as never);
    renderApp('/drawers', { me: superAdminMe, api });
    const dialog = await openEditor();
    await userEvent.click(dialog.getByRole('button', { name: 'Remove photo' }));
    expect(await dialog.findByRole('img', { name: 'No cover photo' })).toBeInTheDocument();
    expect(
      api.calls.some((c) => c.method === 'DELETE' && c.path === '/v1/admin/drawers/d-1/photo'),
    ).toBe(true);
  });

  it('P-06 a server refusal is explained', async () => {
    setup(null, {
      'POST /v1/admin/drawers/:id/photo': () =>
        problemResponse(422, 'VALIDATION_FAILED', 'bad picture', [
          { field: 'photo', message: 'must be a JPEG, PNG or WebP image' },
        ]),
    });
    const dialog = await openEditor();
    await user.upload(dialog.getByLabelText('Choose cover photo'), png());
    expect(await dialog.findByRole('alert')).toBeInTheDocument();
  });

  it('P-07 someone who may only read drawers has no Edit, so no photo controls', async () => {
    setup(MEDIA, {}, meWith(['drawers:read']));
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

describe('drawer list thumbnails', () => {
  it('P-08 each row shows the cover, or the first letter when there is none', async () => {
    const api = mockApi({
      'GET /v1/admin/drawers': [
        { ...drawerA, photoUrl: MEDIA },
        { ...drawerA, id: 'd-9', name: 'Koramangala', photoUrl: null },
      ],
    } as never);
    renderApp('/drawers', { me: superAdminMe, api });
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(
      within(rows[1]!).getByTestId('cover-thumb').querySelector('img')?.getAttribute('src'),
    ).toBe(MEDIA);
    expect(within(rows[2]!).getByTestId('cover-thumb')).toHaveTextContent('K');
  });
});
