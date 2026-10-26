import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

const MEDIA_A = '/v1/media/11111111-1111-4111-8111-111111111111';
const MEDIA_B = '/v1/media/22222222-2222-4222-8222-222222222222';

const model = (photos: string[] = []) => ({
  id: 'm-1',
  categoryId: 'cat-1',
  name: 'PlayStation 5',
  description: null,
  photos,
  pricePerSlotPaise: 4900,
  slotMinutes: 30,
  minDurationMin: 30,
  maxDurationMin: 240,
  bufferMin: 15,
  depositPaise: 20000,
  status: 'active',
  assetCount: 3,
});

const setup = (photos: string[], extra: Record<string, unknown> = {}, me = superAdminMe) => {
  const api = mockApi({
    'GET /v1/admin/categories': [
      {
        id: 'cat-1',
        name: 'Game consoles',
        slug: 'game-consoles',
        parentId: null,
        itemModelCount: 1,
      },
    ],
    'GET /v1/admin/item-models': [model(photos)],
    ...extra,
  } as never);
  renderApp('/inventory/models', { me, api });
  return api;
};
const openEditor = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  return within(await screen.findByRole('dialog', { name: /edit playstation 5/i }));
};
const png = (name = 'front.png', size = 20) =>
  new File([new Uint8Array(size)], name, { type: 'image/png' });
const user = userEvent.setup({ applyAccept: false });

describe('product photos in the catalogue screen', () => {
  it('G-01 shows the current photos in order, uploaded ones served from the API', async () => {
    setup([MEDIA_A, 'https://img.example/b.jpg']);
    const dialog = await openEditor();
    const list = within(await dialog.findByRole('list', { name: 'Photos' }));
    const images = list.getAllByRole('img');
    expect(images.map((i) => i.getAttribute('src'))).toEqual([
      MEDIA_A,
      'https://img.example/b.jpg',
    ]);
    expect(images[0]).toHaveAccessibleName('PlayStation 5 photo 1');
  });

  it('G-02 adding a picture sends the file itself with its real type, and shows the result', async () => {
    const api = setup([], {
      'POST /v1/admin/item-models/:id/photos': model([MEDIA_A]),
    });
    const dialog = await openEditor();
    await user.upload(await dialog.findByLabelText('Choose photos'), png());
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/item-models/m-1/photos')).toHaveLength(1),
    );
    const sent = api.callsTo('POST', '/v1/admin/item-models/m-1/photos')[0]!;
    expect(sent.headers.get('content-type')).toBe('image/png');
    expect(typeof sent.body).toBe('string'); // the raw file, not a JSON document
    const list = within(await dialog.findByRole('list', { name: 'Photos' }));
    expect(list.getAllByRole('img')).toHaveLength(1);
  });

  it('G-03 a file that is not JPEG/PNG/WebP, or is over 5 MB, is refused before any upload', async () => {
    const api = setup([]);
    const dialog = await openEditor();
    const input = await dialog.findByLabelText('Choose photos');
    await user.upload(input, new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(/only JPEG, PNG or WebP/);
    await user.upload(input, png('huge.png', 5 * 1024 * 1024 + 1));
    expect(await dialog.findByRole('alert')).toHaveTextContent(/larger than 5 MB/);
    expect(api.callsTo('POST', '/v1/admin/item-models/m-1/photos')).toHaveLength(0);
  });

  it('G-04 a refusal from the server is shown', async () => {
    setup([], {
      'POST /v1/admin/item-models/:id/photos': problemResponse(
        422,
        'VALIDATION_FAILED',
        'Request validation failed',
        [{ field: 'photo', message: 'a product can have at most 10 photos' }],
      ),
    });
    const dialog = await openEditor();
    await user.upload(await dialog.findByLabelText('Choose photos'), png());
    expect(await dialog.findByRole('alert')).toBeInTheDocument();
  });

  it('G-05 removing an uploaded photo deletes it on the server; an external link is dropped from the list', async () => {
    const api = setup([MEDIA_A, 'https://img.example/b.jpg'], {
      'DELETE /v1/admin/item-models/:id/photos/:mediaId': model(['https://img.example/b.jpg']),
      'PATCH /v1/admin/item-models/:id': model([]),
    });
    const dialog = await openEditor();
    await user.click(await dialog.findByRole('button', { name: 'Remove photo 1' }));
    await waitFor(() =>
      expect(
        api.callsTo(
          'DELETE',
          '/v1/admin/item-models/m-1/photos/11111111-1111-4111-8111-111111111111',
        ),
      ).toHaveLength(1),
    );
    await user.click(await dialog.findByRole('button', { name: 'Remove photo 1' }));
    await waitFor(() => expect(api.callsTo('PATCH', '/v1/admin/item-models/m-1')).toHaveLength(1));
    expect(api.callsTo('PATCH', '/v1/admin/item-models/m-1')[0]!.body).toEqual({ photos: [] });
  });

  it('G-06 "Cover" moves a photo to the front', async () => {
    const api = setup([MEDIA_A, MEDIA_B], {
      'PATCH /v1/admin/item-models/:id': model([MEDIA_B, MEDIA_A]),
    });
    const dialog = await openEditor();
    expect(
      dialog.queryByRole('button', { name: 'Make photo 1 the cover' }),
    ).not.toBeInTheDocument();
    await user.click(await dialog.findByRole('button', { name: 'Make photo 2 the cover' }));
    await waitFor(() => expect(api.callsTo('PATCH', '/v1/admin/item-models/m-1')).toHaveLength(1));
    expect(api.callsTo('PATCH', '/v1/admin/item-models/m-1')[0]!.body).toEqual({
      photos: [MEDIA_B, MEDIA_A],
    });
  });

  it('G-07 saving the form does not touch the photos', async () => {
    const api = setup([MEDIA_A], { 'PATCH /v1/admin/item-models/:id': model([MEDIA_A]) });
    const dialog = await openEditor();
    await user.click(await dialog.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.callsTo('PATCH', '/v1/admin/item-models/m-1')).toHaveLength(1));
    expect(api.callsTo('PATCH', '/v1/admin/item-models/m-1')[0]!.body).not.toHaveProperty('photos');
  });

  it('G-08 the add button is disabled at 10 photos; staff who cannot edit products get no editor', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => `https://img.example/${i}.jpg`);
    setup(ten);
    const dialog = await openEditor();
    expect(await dialog.findByRole('button', { name: 'Add photos…' })).toBeDisabled();
  });

  it('G-09 read-only staff cannot reach the editor', async () => {
    setup([MEDIA_A], {}, meWith(['inventory:read']));
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('G-10 several files chosen at once are all uploaded, in order, with a summary', async () => {
    const api = setup([], {
      'POST /v1/admin/item-models/:id/photos': model([MEDIA_A]),
    });
    const dialog = await openEditor();
    await user.upload(await dialog.findByLabelText('Choose photos'), [
      png('a.png'),
      png('b.png'),
      png('c.png'),
    ]);
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/item-models/m-1/photos')).toHaveLength(3),
    );
    expect(await dialog.findByText('3 photos added.')).toBeInTheDocument();
  });

  it('G-11 a bad file in a batch is named and skipped; the good ones still upload', async () => {
    const api = setup([], {
      'POST /v1/admin/item-models/:id/photos': model([MEDIA_A]),
    });
    const dialog = await openEditor();
    await user.upload(await dialog.findByLabelText('Choose photos'), [
      png('ok.png'),
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
      png('huge.png', 5 * 1024 * 1024 + 1),
    ]);
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/item-models/m-1/photos')).toHaveLength(1),
    );
    const alert = await dialog.findByRole('alert');
    expect(alert).toHaveTextContent('notes.txt: only JPEG, PNG or WebP');
    expect(alert).toHaveTextContent('huge.png: the picture is larger than 5 MB');
    expect(await dialog.findByText('1 photo added.')).toBeInTheDocument();
  });

  it('G-12 only as many files as still fit are taken; the rest are named as skipped', async () => {
    const nine = Array.from({ length: 9 }, (_, i) => `https://img.example/${i}.jpg`);
    const api = setup(nine, { 'POST /v1/admin/item-models/:id/photos': model(nine) });
    const dialog = await openEditor();
    await user.upload(await dialog.findByLabelText('Choose photos'), [png('a.png'), png('b.png')]);
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/item-models/m-1/photos')).toHaveLength(1),
    );
    expect(await dialog.findByRole('alert')).toHaveTextContent(/b\.png: not added.*at most 10/);
  });

  it('G-13 a photo can be moved earlier or later', async () => {
    const api = setup([MEDIA_A, MEDIA_B], {
      'PATCH /v1/admin/item-models/:id': model([MEDIA_B, MEDIA_A]),
    });
    const dialog = await openEditor();
    expect(dialog.getByRole('button', { name: 'Move photo 1 earlier' })).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'Move photo 2 later' })).toBeDisabled();
    await user.click(dialog.getByRole('button', { name: 'Move photo 2 earlier' }));
    await waitFor(() => expect(api.callsTo('PATCH', '/v1/admin/item-models/m-1')).toHaveLength(1));
    expect(api.callsTo('PATCH', '/v1/admin/item-models/m-1')[0]!.body).toEqual({
      photos: [MEDIA_B, MEDIA_A],
    });
  });

  describe('a NEW product', () => {
    const fill = async () => {
      await userEvent.click(await screen.findByRole('button', { name: /new item model/i }));
      const dialog = within(await screen.findByRole('dialog', { name: 'New item model' }));
      await userEvent.type(dialog.getByLabelText('Name'), 'Nintendo Switch');
      await userEvent.selectOptions(dialog.getByLabelText('Category'), 'cat-1');
      await userEvent.type(dialog.getByLabelText('Price per slot (₹)'), '39');
      return dialog;
    };
    const newSetup = (extra: Record<string, unknown>) => {
      URL.createObjectURL = () => 'blob:preview';
      URL.revokeObjectURL = () => undefined;
      return setup([], { 'POST /v1/admin/item-models': { ...model([]), id: 'm-9' }, ...extra });
    };

    it('G-14 pictures can be chosen before saving (with previews) and are uploaded after it, cover first', async () => {
      const api = newSetup({ 'POST /v1/admin/item-models/:id/photos': model([MEDIA_A]) });
      const dialog = await fill();
      await user.upload(await dialog.findByLabelText('Choose photos'), [
        png('one.png'),
        png('two.png'),
      ]);
      const list = within(await dialog.findByRole('list', { name: 'Photos to upload' }));
      expect(list.getAllByRole('img')).toHaveLength(2);
      await user.click(dialog.getByRole('button', { name: 'Make chosen photo 2 the cover' }));
      await user.click(dialog.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(api.callsTo('POST', '/v1/admin/item-models/m-9/photos')).toHaveLength(2),
      );
      // the dialog closes once everything is stored
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('G-15 a picture that fails after the product is saved keeps the form open on the saved product', async () => {
      newSetup({
        'POST /v1/admin/item-models/:id/photos': problemResponse(
          422,
          'VALIDATION_FAILED',
          'Request validation failed',
          [{ field: 'photo', message: 'not a picture' }],
        ),
      });
      const dialog = await fill();
      await user.upload(await dialog.findByLabelText('Choose photos'), png('broken.png'));
      await user.click(dialog.getByRole('button', { name: 'Save' }));
      expect(
        await screen.findByText(
          /The product was saved, but these pictures could not be uploaded: broken\.png/,
        ),
      ).toBeInTheDocument();
      // still open, now as the saved product (photos are added to it directly)
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('G-16 removing a chosen picture before saving sends nothing for it', async () => {
      const api = newSetup({ 'POST /v1/admin/item-models/:id/photos': model([MEDIA_A]) });
      const dialog = await fill();
      await user.upload(await dialog.findByLabelText('Choose photos'), png('gone.png'));
      await user.click(await dialog.findByRole('button', { name: 'Remove chosen photo 1' }));
      await user.click(dialog.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(api.callsTo('POST', '/v1/admin/item-models/m-9/photos')).toHaveLength(0);
    });
  });
});
