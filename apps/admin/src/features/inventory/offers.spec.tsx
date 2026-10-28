import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

const DAY = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
/** The value a `datetime-local` field holds for an instant, in the browser's own zone. */
const local = (offsetMs: number) => {
  const d = new Date(Date.now() + offsetMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const user = userEvent.setup({ applyAccept: false });

const category = {
  id: 'cat-1',
  name: 'Game consoles',
  slug: 'game-consoles',
  parentId: null,
  itemModelCount: 1,
};
const model = (o: Record<string, unknown> = {}) => ({
  id: 'm-1',
  categoryId: 'cat-1',
  name: 'PlayStation 5',
  description: null,
  photos: [],
  pricePerSlotPaise: 4900,
  slotMinutes: 30,
  minDurationMin: 30,
  maxDurationMin: 240,
  bufferMin: 15,
  depositPaise: 20000,
  status: 'active',
  assetCount: 3,
  discountPercent: null,
  discountStartsAt: null,
  discountEndsAt: null,
  offerState: 'none',
  featured: false,
  isNew: false,
  createdAt: '2030-01-01T00:00:00.000Z',
  ...o,
});

describe('offers on products (item models page)', () => {
  const setup = (models: unknown[], extra: Record<string, unknown> = {}, me = superAdminMe) => {
    const api = mockApi({
      'GET /v1/admin/categories': [category],
      'GET /v1/admin/item-models': models,
      ...extra,
    } as never);
    renderApp('/inventory/models', { me, api });
    return api;
  };
  const row = async (name: string) => {
    const table = await screen.findByRole('table', { name: 'Item models' });
    return within(within(table).getByText(name).closest('tr') as HTMLElement);
  };

  it('O-01 an active offer shows the price to pay with the normal price struck out and a −% badge', async () => {
    setup([
      model({
        discountPercent: 20,
        offerState: 'active',
        discountEndsAt: iso(DAY),
      }),
    ]);
    const r = await row('PlayStation 5');
    expect(r.getByText('₹39.20')).toBeInTheDocument();
    expect(r.getByText('₹49.00')).toHaveClass('line-through');
    expect(r.getByText('−20% offer')).toBeInTheDocument();
  });

  it('O-02 the discount rounds down to whole paise, like the server does (never more than the stated percent)', async () => {
    setup([model({ pricePerSlotPaise: 9999, discountPercent: 20, offerState: 'active' })]);
    const r = await row('PlayStation 5');
    expect(r.getByText('₹80.00')).toBeInTheDocument(); // 9999 − floor(1999.8) = 8000
  });

  it('O-03 scheduled, ended, new and featured are told apart; no offer shows the plain price', async () => {
    setup([
      model({
        id: 'a',
        name: 'Scheduled one',
        discountPercent: 30,
        offerState: 'scheduled',
        discountStartsAt: iso(2 * DAY),
      }),
      model({
        id: 'b',
        name: 'Ended one',
        discountPercent: 30,
        offerState: 'ended',
        discountEndsAt: iso(-DAY),
      }),
      model({ id: 'c', name: 'Fresh one', isNew: true, featured: true }),
      model({ id: 'd', name: 'Plain one' }),
    ]);
    expect((await row('Scheduled one')).getByText(/−30% from/)).toBeInTheDocument();
    expect((await row('Scheduled one')).getByText('₹49.00')).not.toHaveClass('line-through');
    expect((await row('Ended one')).getByText('Offer ended')).toBeInTheDocument();
    const fresh = await row('Fresh one');
    expect(fresh.getByText('New')).toBeInTheDocument();
    expect(fresh.getByText('Featured')).toBeInTheDocument();
    const plain = await row('Plain one');
    expect(plain.queryByText(/offer/i)).not.toBeInTheDocument();
    expect(plain.queryByText('New')).not.toBeInTheDocument();
  });

  it('O-04 creating a product with an offer sends the percent, the window as UTC instants and the featured flag', async () => {
    const api = setup([], { 'POST /v1/admin/item-models': model({ id: 'm-9' }) });
    await user.click(await screen.findByRole('button', { name: /new item model/i }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New item model' }));
    await user.type(dialog.getByLabelText('Name'), 'Switch');
    await user.selectOptions(dialog.getByLabelText('Category'), 'cat-1');
    await user.type(dialog.getByLabelText('Price per slot (₹)'), '49');
    await user.type(dialog.getByLabelText('Discount (%)'), '20');
    fireEvent.change(dialog.getByLabelText('Offer starts'), { target: { value: local(DAY) } });
    fireEvent.change(dialog.getByLabelText('Offer ends'), { target: { value: local(3 * DAY) } });
    await user.click(dialog.getByLabelText(/feature this product/i));
    // what customers will pay, shown while typing
    expect(dialog.getByText(/₹39\.20/)).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.callsTo('POST', '/v1/admin/item-models')).toHaveLength(1));
    const sent = api.callsTo('POST', '/v1/admin/item-models')[0]!.body as Record<string, unknown>;
    expect(sent).toMatchObject({ discountPercent: 20, featured: true });
    expect(sent['discountStartsAt']).toBe(new Date(local(DAY)).toISOString());
    expect(sent['discountEndsAt']).toBe(new Date(local(3 * DAY)).toISOString());
  });

  it('O-05 no offer is sent as nulls (so an old offer is cleared on edit), and the dates are dropped without a percent', async () => {
    const api = setup(
      [model({ discountPercent: 20, offerState: 'active', discountEndsAt: iso(DAY) })],
      { 'PATCH /v1/admin/item-models/:id': model() },
    );
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByLabelText('Discount (%)')).toHaveValue('20');
    expect((dialog.getByLabelText('Offer ends') as HTMLInputElement).value).not.toBe('');
    await user.clear(dialog.getByLabelText('Discount (%)'));
    await user
      .clear(dialog.getByLabelText('Offer ends') as HTMLInputElement)
      .catch(() => undefined);
    fireEvent.change(dialog.getByLabelText('Offer ends'), { target: { value: '' } });
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.callsTo('PATCH', '/v1/admin/item-models/m-1')).toHaveLength(1));
    expect(api.callsTo('PATCH', '/v1/admin/item-models/m-1')[0]!.body).toMatchObject({
      discountPercent: null,
      discountStartsAt: null,
      discountEndsAt: null,
    });
  });

  it.each([
    ['0', 'discountPercent', /whole number from 1 to 90/],
    ['91', 'discountPercent', /whole number from 1 to 90/],
    ['12.5', 'discountPercent', /whole number from 1 to 90/],
    ['abc', 'discountPercent', /whole number from 1 to 90/],
  ])('O-06 a percent of "%s" is refused on the field and nothing is sent', async (text) => {
    const api = setup([], { 'POST /v1/admin/item-models': model() });
    await user.click(await screen.findByRole('button', { name: /new item model/i }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Name'), 'X');
    await user.selectOptions(dialog.getByLabelText('Category'), 'cat-1');
    await user.type(dialog.getByLabelText('Price per slot (₹)'), '10');
    await user.type(dialog.getByLabelText('Discount (%)'), text);
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText(/whole number from 1 to 90/)).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/item-models')).toHaveLength(0);
  });

  it('O-07 dates without a percent, an end before the start and a new end in the past are each explained', async () => {
    const api = setup([], { 'POST /v1/admin/item-models': model() });
    await user.click(await screen.findByRole('button', { name: /new item model/i }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Name'), 'X');
    await user.selectOptions(dialog.getByLabelText('Category'), 'cat-1');
    await user.type(dialog.getByLabelText('Price per slot (₹)'), '10');

    fireEvent.change(dialog.getByLabelText('Offer ends'), { target: { value: local(DAY) } });
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(
      await dialog.findByText('Add a discount percent, or clear this date.'),
    ).toBeInTheDocument();

    await user.type(dialog.getByLabelText('Discount (%)'), '10');
    fireEvent.change(dialog.getByLabelText('Offer starts'), { target: { value: local(3 * DAY) } });
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Must be after the start.')).toBeInTheDocument();

    fireEvent.change(dialog.getByLabelText('Offer starts'), { target: { value: '' } });
    fireEvent.change(dialog.getByLabelText('Offer ends'), { target: { value: local(-DAY) } });
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Must be in the future.')).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/item-models')).toHaveLength(0);
  });

  it("O-08 the server's own refusal of the offer is shown on its field", async () => {
    setup([model()], {
      'PATCH /v1/admin/item-models/:id': problemResponse(422, 'VALIDATION_FAILED', 'invalid', [
        { field: 'discountEndsAt', message: 'must be after the start' },
      ]),
    });
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Discount (%)'), '10');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('must be after the start')).toBeInTheDocument();
  });

  it('O-09 an offer that ran out may keep its old end date while something else is changed', async () => {
    const api = setup(
      [model({ discountPercent: 20, offerState: 'ended', discountEndsAt: iso(-2 * DAY) })],
      { 'PATCH /v1/admin/item-models/:id': model() },
    );
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.clear(dialog.getByLabelText('Name'));
    await user.type(dialog.getByLabelText('Name'), 'Renamed');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.callsTo('PATCH', '/v1/admin/item-models/m-1')).toHaveLength(1));
    expect(dialog.queryByText('Must be in the future.')).not.toBeInTheDocument();
  });

  it('O-10 staff who cannot write the catalogue see the offer badges but get no way to change them', async () => {
    setup([model({ discountPercent: 20, offerState: 'active' })], {}, meWith(['inventory:read']));
    const r = await row('PlayStation 5');
    expect(r.getByText('−20% offer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
const banner = (o: Record<string, unknown> = {}) => ({
  id: 'p-1',
  title: 'Weekend offer',
  subtitle: '20% off consoles',
  ctaLabel: 'Shop now',
  theme: 'orange',
  imageUrl: null,
  itemModelId: 'm-1',
  itemModelName: 'PlayStation 5',
  startsAt: null,
  endsAt: null,
  active: true,
  sortOrder: 0,
  state: 'live',
  createdAt: '2030-01-01T00:00:00.000Z',
  ...o,
});
const png = (name = 'banner.png', size = 20) =>
  new File([new Uint8Array(size)], name, { type: 'image/png' });

describe('banners (Offers & banners page)', () => {
  const setup = (banners: unknown[], extra: Record<string, unknown> = {}, me = superAdminMe) => {
    const api = mockApi({
      'GET /v1/admin/promotions': banners,
      'GET /v1/admin/item-models': [
        model(),
        model({ id: 'm-2', name: 'Old camera', status: 'inactive' }),
      ],
      'GET /v1/admin/categories': [category],
      ...extra,
    } as never);
    renderApp('/offers', { me, api });
    return api;
  };
  const stubUrls = () => {
    URL.createObjectURL = () => 'blob:preview';
    URL.revokeObjectURL = () => undefined;
  };

  it('B-01 lists every banner with what it opens, when it shows and whether customers can see it now', async () => {
    setup([
      banner(),
      banner({
        id: 'p-2',
        title: 'Coming soon',
        state: 'scheduled',
        startsAt: iso(2 * DAY),
        itemModelId: null,
        itemModelName: null,
      }),
      banner({ id: 'p-3', title: 'Old news', state: 'ended', endsAt: iso(-DAY) }),
      banner({ id: 'p-4', title: 'Hidden', state: 'off', active: false }),
    ]);
    const table = await screen.findByRole('table', { name: 'Banners' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    expect(within(rows[0]!).getByText('Weekend offer')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('PlayStation 5')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Live')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Always')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Scheduled')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Nothing')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/^From /)).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Ended')).toBeInTheDocument();
    expect(within(rows[2]!).getByText(/^Until /)).toBeInTheDocument();
    expect(within(rows[3]!).getByText('Off')).toBeInTheDocument();
  });

  it('B-02 with no banners it says so and how to start; read-only staff get no buttons', async () => {
    setup([], {}, meWith(['inventory:read']));
    expect(await screen.findByText('No banners yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New banner' })).not.toBeInTheDocument();
  });

  it('B-03 a new banner needs only a title; the colour, order and on-switch have sensible defaults', async () => {
    const api = setup([], { 'POST /v1/admin/promotions': banner({ id: 'p-9' }) });
    await user.click(await screen.findByRole('button', { name: 'New banner' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New banner' }));
    await user.type(dialog.getByLabelText('Title'), 'Big sale');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.callsTo('POST', '/v1/admin/promotions')).toHaveLength(1));
    expect(api.callsTo('POST', '/v1/admin/promotions')[0]!.body).toEqual({
      title: 'Big sale',
      subtitle: null,
      ctaLabel: null,
      theme: 'orange',
      itemModelId: null,
      startsAt: null,
      endsAt: null,
      sortOrder: 0,
      active: true,
    });
  });

  it('B-04 the preview follows what is typed, and a chosen colour and product go with the banner', async () => {
    const api = setup([], { 'POST /v1/admin/promotions': banner({ id: 'p-9' }) });
    await user.click(await screen.findByRole('button', { name: 'New banner' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Title'), 'Flash sale');
    await user.type(dialog.getByLabelText('Subtitle'), 'Today only');
    await user.type(dialog.getByLabelText('Button label'), 'Grab it');
    expect(dialog.getByText('Flash sale')).toBeInTheDocument(); // the preview card
    expect(dialog.getByText('Today only')).toBeInTheDocument();
    expect(dialog.getByText('Grab it')).toBeInTheDocument();
    await user.selectOptions(dialog.getByLabelText('Colour'), 'plum');
    await user.selectOptions(dialog.getByLabelText('Opens this product'), 'm-1');
    fireEvent.change(dialog.getByLabelText('Shows from'), { target: { value: local(DAY) } });
    fireEvent.change(dialog.getByLabelText('Shows until'), { target: { value: local(2 * DAY) } });
    await user.clear(dialog.getByLabelText('Order'));
    await user.type(dialog.getByLabelText('Order'), '3');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.callsTo('POST', '/v1/admin/promotions')).toHaveLength(1));
    const sent = api.callsTo('POST', '/v1/admin/promotions')[0]!.body as Record<string, unknown>;
    expect(sent).toMatchObject({
      title: 'Flash sale',
      subtitle: 'Today only',
      ctaLabel: 'Grab it',
      theme: 'plum',
      itemModelId: 'm-1',
      sortOrder: 3,
    });
    expect(sent['startsAt']).toBe(new Date(local(DAY)).toISOString());
    expect(sent['endsAt']).toBe(new Date(local(2 * DAY)).toISOString());
  });

  it.each([
    ['an empty title', { title: '' }, 'Enter a title.'],
    ['a title over 80 characters', { title: 'x'.repeat(81) }, 'Use at most 80 characters.'],
    [
      'a subtitle over 160 characters',
      { title: 't', subtitle: 'y'.repeat(161) },
      'Use at most 160 characters.',
    ],
    [
      'a button label over 30 characters',
      { title: 't', ctaLabel: 'z'.repeat(31) },
      'Use at most 30 characters.',
    ],
    [
      'an order that is not a whole number',
      { title: 't', order: '1.5' },
      'Enter a whole number from 0 to 10000.',
    ],
    [
      'an order above 10000',
      { title: 't', order: '10001' },
      'Enter a whole number from 0 to 10000.',
    ],
  ])('B-05 %s is refused on its field and nothing is sent', async (_label, values, message) => {
    const api = setup([], { 'POST /v1/admin/promotions': banner() });
    await user.click(await screen.findByRole('button', { name: 'New banner' }));
    const dialog = within(await screen.findByRole('dialog'));
    const v = values as Record<string, string>;
    if (v['title'])
      fireEvent.change(dialog.getByLabelText('Title'), { target: { value: v['title'] } });
    if (v['subtitle'])
      fireEvent.change(dialog.getByLabelText('Subtitle'), { target: { value: v['subtitle'] } });
    if (v['ctaLabel'])
      fireEvent.change(dialog.getByLabelText('Button label'), { target: { value: v['ctaLabel'] } });
    if (v['order'])
      fireEvent.change(dialog.getByLabelText('Order'), { target: { value: v['order'] } });
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText(message)).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/promotions')).toHaveLength(0);
  });

  it('B-06 the end must be after the start', async () => {
    const api = setup([], { 'POST /v1/admin/promotions': banner() });
    await user.click(await screen.findByRole('button', { name: 'New banner' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Title'), 't');
    fireEvent.change(dialog.getByLabelText('Shows from'), { target: { value: local(2 * DAY) } });
    fireEvent.change(dialog.getByLabelText('Shows until'), { target: { value: local(DAY) } });
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Must be after the start.')).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/promotions')).toHaveLength(0);
  });

  it("B-07 the server's refusal is shown on its field", async () => {
    setup([], {
      'POST /v1/admin/promotions': problemResponse(422, 'VALIDATION_FAILED', 'invalid', [
        { field: 'itemModelId', message: 'no such product' },
      ]),
    });
    await user.click(await screen.findByRole('button', { name: 'New banner' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Title'), 't');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('no such product')).toBeInTheDocument();
  });

  it('B-08 a picture chosen for a NEW banner is previewed and uploaded right after it is saved', async () => {
    stubUrls();
    const api = setup([], {
      'POST /v1/admin/promotions': banner({ id: 'p-9' }),
      'POST /v1/admin/promotions/:id/image': banner({
        id: 'p-9',
        imageUrl: '/v1/media/11111111-1111-4111-8111-111111111111',
      }),
    });
    await user.click(await screen.findByRole('button', { name: 'New banner' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Title'), 'With picture');
    await user.upload(dialog.getByLabelText('Choose photos'), png());
    expect(await dialog.findByRole('button', { name: 'Remove picture' })).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/promotions/p-9/image')).toHaveLength(1),
    );
    const sent = api.callsTo('POST', '/v1/admin/promotions/p-9/image')[0]!;
    expect(sent.headers.get('content-type')).toBe('image/png');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('B-09 a bad picture (wrong type, empty, over 5 MB) is refused before anything is sent', async () => {
    stubUrls();
    const api = setup([banner()]);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = within(await screen.findByRole('dialog'));
    const input = dialog.getByLabelText('Choose photos');
    await user.upload(input, new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(/only JPEG, PNG or WebP/);
    await user.upload(input, png('huge.png', 5 * 1024 * 1024 + 1));
    expect(await dialog.findByRole('alert')).toHaveTextContent(/larger than 5 MB/);
    await user.upload(input, png('empty.png', 0));
    expect(await dialog.findByRole('alert')).toHaveTextContent(/empty/);
    expect(api.callsTo('POST', '/v1/admin/promotions/p-1/image')).toHaveLength(0);
  });

  it('B-10 on an existing banner the picture is replaced or removed at once', async () => {
    const withPicture = banner({ imageUrl: '/v1/media/11111111-1111-4111-8111-111111111111' });
    const api = setup([withPicture], {
      'POST /v1/admin/promotions/:id/image': banner({
        imageUrl: '/v1/media/22222222-2222-4222-8222-222222222222',
      }),
      'DELETE /v1/admin/promotions/:id/image': banner(),
    });
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.upload(dialog.getByLabelText('Choose photos'), png());
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/promotions/p-1/image')).toHaveLength(1),
    );
    await user.click(await dialog.findByRole('button', { name: 'Remove picture' }));
    await waitFor(() =>
      expect(api.callsTo('DELETE', '/v1/admin/promotions/p-1/image')).toHaveLength(1),
    );
    await waitFor(() =>
      expect(dialog.queryByRole('button', { name: 'Remove picture' })).not.toBeInTheDocument(),
    );
  });

  it('B-11 editing sends the changes; clearing the product and the dates sends nulls', async () => {
    const api = setup([banner({ startsAt: iso(DAY), endsAt: iso(2 * DAY) })], {
      'PATCH /v1/admin/promotions/:id': banner(),
    });
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByLabelText('Title')).toHaveValue('Weekend offer');
    expect(dialog.getByLabelText('Opens this product')).toHaveValue('m-1');
    await user.selectOptions(dialog.getByLabelText('Opens this product'), '');
    fireEvent.change(dialog.getByLabelText('Shows from'), { target: { value: '' } });
    fireEvent.change(dialog.getByLabelText('Shows until'), { target: { value: '' } });
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.callsTo('PATCH', '/v1/admin/promotions/p-1')).toHaveLength(1));
    expect(api.callsTo('PATCH', '/v1/admin/promotions/p-1')[0]!.body).toMatchObject({
      itemModelId: null,
      startsAt: null,
      endsAt: null,
    });
  });

  it('B-12 a banner is switched off and on from the list without opening it', async () => {
    const api = setup(
      [banner(), banner({ id: 'p-2', title: 'Hidden', active: false, state: 'off' })],
      {
        'PATCH /v1/admin/promotions/:id': banner(),
      },
    );
    await user.click(await screen.findByRole('button', { name: 'Turn off Weekend offer' }));
    await waitFor(() => expect(api.callsTo('PATCH', '/v1/admin/promotions/p-1')).toHaveLength(1));
    expect(api.callsTo('PATCH', '/v1/admin/promotions/p-1')[0]!.body).toEqual({ active: false });
    await user.click(screen.getByRole('button', { name: 'Turn on Hidden' }));
    await waitFor(() => expect(api.callsTo('PATCH', '/v1/admin/promotions/p-2')).toHaveLength(1));
    expect(api.callsTo('PATCH', '/v1/admin/promotions/p-2')[0]!.body).toEqual({ active: true });
  });

  it('B-13 deleting asks first; only after confirming is anything sent', async () => {
    const api = setup([banner()], { 'DELETE /v1/admin/promotions/:id': undefined });
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const ask = within(await screen.findByRole('dialog', { name: 'Delete banner?' }));
    expect(ask.getByText(/turn it off/i)).toBeInTheDocument();
    await user.click(ask.getByRole('button', { name: 'Cancel' }));
    expect(api.callsTo('DELETE', '/v1/admin/promotions/p-1')).toHaveLength(0);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete banner?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => expect(api.callsTo('DELETE', '/v1/admin/promotions/p-1')).toHaveLength(1));
  });

  it('B-14 a failed list load offers a retry', async () => {
    let calls = 0;
    setup([], {
      'GET /v1/admin/promotions': () => {
        calls += 1;
        return calls === 1 ? problemResponse(503, 'RETRY_LATER', 'busy') : [banner()];
      },
    });
    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Weekend offer')).toBeInTheDocument();
  });
});
