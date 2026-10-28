import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { drawerA, drawerB } from '@/test/fixtures';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

const category = (o: Record<string, unknown> = {}) => ({
  id: 'cat-1',
  name: 'Game consoles',
  slug: 'game-consoles',
  parentId: null,
  itemModelCount: 2,
  ...o,
});
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
  ...o,
});
const asset = (o: Record<string, unknown> = {}) => ({
  id: 'a-1',
  assetCode: 'PS5-001',
  itemModelId: 'm-1',
  itemModelName: 'PlayStation 5',
  drawerId: 'd-1',
  drawerName: 'Indiranagar',
  serialNo: null,
  status: 'available',
  ...o,
});

describe('categories', () => {
  it('I-01 lists categories with their parent and number of item models', async () => {
    const api = mockApi({
      'GET /v1/admin/categories': [
        category(),
        category({ id: 'cat-2', name: 'VR', slug: 'vr', parentId: 'cat-1', itemModelCount: 0 }),
      ],
    });
    renderApp('/inventory/categories', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Categories' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[1]!).getByText('Game consoles')).toBeInTheDocument(); // inside
  });

  it('I-02 read-only staff see the list without any buttons', async () => {
    const api = mockApi({ 'GET /v1/admin/categories': [category()] });
    renderApp('/inventory/categories', { me: meWith(['inventory:read']), api });
    await screen.findByRole('table', { name: 'Categories' });
    expect(screen.queryByRole('button', { name: /new category/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('I-03 creating a category sends the name and an optional parent; the list refreshes', async () => {
    const api = mockApi({
      'GET /v1/admin/categories': [category()],
      'POST /v1/admin/categories': category({ id: 'cat-3' }),
    });
    renderApp('/inventory/categories', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new category/i }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New category' }));
    await userEvent.type(dialog.getByLabelText('Name'), 'Cameras');
    await userEvent.selectOptions(dialog.getByLabelText('Inside category'), 'cat-1');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitForClosed();
    expect(api.callsTo('POST', '/v1/admin/categories')[0]?.body).toEqual({
      name: 'Cameras',
      parentId: 'cat-1',
    });
    expect(api.callsTo('GET', '/v1/admin/categories').length).toBeGreaterThanOrEqual(2);
  });

  it('I-04 a duplicate web name is explained next to the field and the form stays open', async () => {
    const api = mockApi({
      'GET /v1/admin/categories': [category()],
      'POST /v1/admin/categories': problemResponse(409, 'ALREADY_EXISTS', 'exists', [
        { field: 'slug', message: 'is already used by another category' },
      ]),
    });
    renderApp('/inventory/categories', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new category/i }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), 'Game consoles');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('is already used by another category')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('I-05 deleting asks first; a category in use is refused with the server’s explanation', async () => {
    const api = mockApi({
      'GET /v1/admin/categories': [category()],
      'DELETE /v1/admin/categories/:id': problemResponse(
        409,
        'IN_USE',
        'This category still has item models',
      ),
    });
    renderApp('/inventory/categories', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = within(await screen.findByRole('dialog', { name: /delete category/i }));
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'This category still has item models',
    );
    expect(api.callsTo('DELETE', '/v1/admin/categories/cat-1')).toHaveLength(1);
  });
});

describe('item models', () => {
  const setup = (extra: Record<string, unknown> = {}) =>
    mockApi({
      'GET /v1/admin/categories': [category()],
      'GET /v1/admin/item-models': [
        model(),
        model({ id: 'm-2', name: 'Old camera', status: 'inactive', assetCount: 0 }),
      ],
      ...extra,
    });

  it('I-06 shows prices in rupees, the slot and length rules, and which models are inactive', async () => {
    renderApp('/inventory/models', { me: superAdminMe, api: setup() });
    const table = await screen.findByRole('table', { name: 'Item models' });
    const first = within(within(table).getAllByRole('row')[1]!);
    expect(first.getByText('₹49.00')).toBeInTheDocument();
    expect(first.getByText('₹200.00')).toBeInTheDocument();
    expect(first.getByText(/30 min slots/)).toBeInTheDocument();
    expect(first.getByText(/15 min cleaning/)).toBeInTheDocument();
    expect(within(table).getByText('Inactive')).toBeInTheDocument();
  });

  it('I-07 creating a model turns rupees into paise and sends whole numbers', async () => {
    const api = setup({ 'POST /v1/admin/item-models': model({ id: 'm-3' }) });
    renderApp('/inventory/models', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new item model/i }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New item model' }));
    await userEvent.type(dialog.getByLabelText('Name'), 'Nintendo Switch');
    await userEvent.selectOptions(dialog.getByLabelText('Category'), 'cat-1');
    await userEvent.type(dialog.getByLabelText('Price per slot (₹)'), '39.50');
    await userEvent.type(dialog.getByLabelText('Deposit (₹)'), '1,500');
    await userEvent.clear(dialog.getByLabelText('Slot length (minutes)'));
    await userEvent.type(dialog.getByLabelText('Slot length (minutes)'), '60');
    await userEvent.clear(dialog.getByLabelText('Shortest rental (minutes)'));
    await userEvent.type(dialog.getByLabelText('Shortest rental (minutes)'), '60');
    expect(dialog.getByText(/uploaded when you save the product/)).toBeInTheDocument(); // pictures can be chosen up front
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitForClosed();
    expect(api.callsTo('POST', '/v1/admin/item-models')[0]?.body).toEqual({
      name: 'Nintendo Switch',
      description: null,
      categoryId: 'cat-1',
      pricePerSlotPaise: 3950,
      slotMinutes: 60,
      minDurationMin: 60,
      maxDurationMin: 240,
      bufferMin: 0,
      depositPaise: 150000,
      discountPercent: null,
      discountStartsAt: null,
      discountEndsAt: null,
      featured: false,
    });
  });

  it('I-08 obviously wrong input is explained on the field and nothing is sent', async () => {
    const api = setup();
    renderApp('/inventory/models', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new item model/i }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Price per slot (₹)'), '12.345');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Enter a name.')).toBeInTheDocument();
    expect(dialog.getByText('Choose a category.')).toBeInTheDocument();
    expect(dialog.getByText('Enter an amount such as 49 or 49.50.')).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/item-models')).toHaveLength(0);
  });

  it('I-08b rules between the numbers are explained in plain words before anything is sent', async () => {
    const api = setup();
    renderApp('/inventory/models', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new item model/i }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), 'a'.repeat(121));
    await userEvent.selectOptions(dialog.getByLabelText('Category'), 'cat-1');
    await userEvent.type(dialog.getByLabelText('Price per slot (₹)'), '10');
    await userEvent.clear(dialog.getByLabelText('Slot length (minutes)'));
    await userEvent.type(dialog.getByLabelText('Slot length (minutes)'), '30');
    await userEvent.clear(dialog.getByLabelText('Shortest rental (minutes)'));
    await userEvent.type(dialog.getByLabelText('Shortest rental (minutes)'), '45');
    await userEvent.clear(dialog.getByLabelText('Longest rental (minutes)'));
    await userEvent.type(dialog.getByLabelText('Longest rental (minutes)'), '100');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Use at most 120 characters.')).toBeInTheDocument();
    expect(dialog.getAllByText('Use a multiple of the slot length (30 minutes).')).toHaveLength(2); // shortest and longest
    expect(api.callsTo('POST', '/v1/admin/item-models')).toHaveLength(0);

    // longest shorter than the shortest
    await userEvent.clear(dialog.getByLabelText('Shortest rental (minutes)'));
    await userEvent.type(dialog.getByLabelText('Shortest rental (minutes)'), '120');
    await userEvent.clear(dialog.getByLabelText('Longest rental (minutes)'));
    await userEvent.type(dialog.getByLabelText('Longest rental (minutes)'), '60');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(
      await dialog.findByText('Must not be shorter than the shortest rental.'),
    ).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/item-models')).toHaveLength(0);
  });

  it('I-09 the server’s own rules are shown on the right field (duration must fit the slot)', async () => {
    const api = setup({
      'POST /v1/admin/item-models': problemResponse(422, 'VALIDATION_FAILED', 'invalid', [
        { field: 'maxDurationMin', message: 'must be a multiple of the slot length' },
      ]),
    });
    renderApp('/inventory/models', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new item model/i }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), 'X');
    await userEvent.selectOptions(dialog.getByLabelText('Category'), 'cat-1');
    await userEvent.type(dialog.getByLabelText('Price per slot (₹)'), '10');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('must be a multiple of the slot length')).toBeInTheDocument();
  });

  it('I-10 editing an item model can deactivate it; the server may refuse while bookings are upcoming', async () => {
    const api = setup({
      'PATCH /v1/admin/item-models/:id': problemResponse(
        409,
        'HAS_FUTURE_BOOKINGS',
        'There are upcoming bookings',
      ),
    });
    renderApp('/inventory/models', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Item models' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: 'Edit' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: /edit playstation 5/i }));
    await userEvent.selectOptions(dialog.getByLabelText('Status'), 'inactive');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('There are upcoming bookings');
    expect(
      (api.callsTo('PATCH', '/v1/admin/item-models/m-1')[0]?.body as { status: string }).status,
    ).toBe('inactive');
  });
});

describe('assets', () => {
  const setup = (extra: Record<string, unknown> = {}) =>
    mockApi({
      'GET /v1/admin/assets': {
        data: [asset(), asset({ id: 'a-2', assetCode: 'PS5-002', status: 'maintenance' })],
        nextCursor: null,
      },
      'GET /v1/admin/drawers': [drawerA, drawerB],
      'GET /v1/admin/item-models': [model()],
      ...extra,
    });

  it('I-11 lists units with their model, drawer and status', async () => {
    renderApp('/inventory/assets', { me: superAdminMe, api: setup() });
    const table = await screen.findByRole('table', { name: 'Assets' });
    expect(within(table).getByText('PS5-002')).toBeInTheDocument();
    expect(within(table).getByText('Maintenance')).toBeInTheDocument();
  });

  it('I-12 filters go to the server', async () => {
    const api = setup();
    renderApp('/inventory/assets', { me: superAdminMe, api });
    await screen.findByRole('table', { name: 'Assets' });
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'maintenance');
    await userEvent.selectOptions(await screen.findByLabelText('Drawer'), 'd-2');
    await userEvent.type(screen.getByLabelText('Code'), 'PS5');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByRole('table', { name: 'Assets' });
    expect(Object.fromEntries(api.callsTo('GET', '/v1/admin/assets').at(-1)!.query)).toEqual({
      limit: '25',
      status: 'maintenance',
      drawerId: 'd-2',
      q: 'PS5',
    });
  });

  it('I-13 creating an asset needs a code, a model and a drawer', async () => {
    const api = setup({ 'POST /v1/admin/assets': asset({ id: 'a-3' }) });
    renderApp('/inventory/assets', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new asset/i }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New asset' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Enter a code such as PS5-001.')).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/assets')).toHaveLength(0);

    await userEvent.type(dialog.getByLabelText('Code'), 'PS5-003');
    await userEvent.selectOptions(dialog.getByLabelText('Item model'), 'm-1');
    await userEvent.selectOptions(dialog.getByLabelText('Drawer'), 'd-1');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitForClosed();
    expect(api.callsTo('POST', '/v1/admin/assets')[0]?.body).toEqual({
      assetCode: 'PS5-003',
      itemModelId: 'm-1',
      drawerId: 'd-1',
    });
  });

  it('I-14 a duplicate code is explained on the field', async () => {
    const api = setup({
      'POST /v1/admin/assets': problemResponse(409, 'ALREADY_EXISTS', 'exists', [
        { field: 'assetCode', message: 'is already used by another asset' },
      ]),
    });
    renderApp('/inventory/assets', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new asset/i }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Code'), 'PS5-001');
    await userEvent.selectOptions(dialog.getByLabelText('Item model'), 'm-1');
    await userEvent.selectOptions(dialog.getByLabelText('Drawer'), 'd-1');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('is already used by another asset')).toBeInTheDocument();
  });

  it('I-15 moving a unit to maintenance sends only what changed', async () => {
    const api = setup({ 'PATCH /v1/admin/assets/:id': asset({ status: 'maintenance' }) });
    renderApp('/inventory/assets', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Assets' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: 'Edit' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: /edit ps5-001/i }));
    await userEvent.selectOptions(dialog.getByLabelText('Status'), 'maintenance');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitForClosed();
    expect(api.callsTo('PATCH', '/v1/admin/assets/a-1')[0]?.body).toEqual({
      serialNo: null,
      status: 'maintenance',
    });
  });
});

async function waitForClosed() {
  await screen.findByRole('heading', { level: 2 }); // page header is back in view
  await new Promise((resolve) => setTimeout(resolve, 0));
  await vi_waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}
import { waitFor as vi_waitFor } from '@testing-library/react';
