import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { drawerA, permissionGroups, roleFixture, superRole } from '@/test/fixtures';
import { mockApi } from '@/test/mock-api';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

const adminFixture = (o: Record<string, unknown> = {}) => ({
  id: 'u-2',
  email: 'ravi@rento.demo',
  displayName: 'Ravi',
  status: 'active',
  roles: [{ roleId: 'r-1', roleName: 'Support', isSuperAdmin: false, drawerId: null }],
  ...o,
});

describe('roles', () => {
  const setup = (extra: Record<string, unknown> = {}) =>
    mockApi({
      'GET /v1/admin/roles': [
        superRole,
        roleFixture(),
        roleFixture({
          id: 'r-2',
          name: 'Finance',
          assignedCount: 0,
          permissions: ['bookings:read', 'bookings:cancel'],
        }),
      ],
      'GET /v1/admin/permissions': permissionGroups,
      ...extra,
    });

  it('R-01 lists roles; the Super Admin is marked locked and has no edit or delete', async () => {
    renderApp('/roles', { me: superAdminMe, api: setup() });
    const table = await screen.findByRole('table', { name: 'Roles' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]!).getByText('Locked')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('All')).toBeInTheDocument();
    expect(within(rows[0]!).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(within(rows[0]!).getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('R-02 viewing the Super Admin shows every permission ticked and nothing can be changed', async () => {
    renderApp('/roles', { me: superAdminMe, api: setup() });
    const table = await screen.findByRole('table', { name: 'Roles' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: 'View' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: 'Super Admin' }));
    for (const box of await dialog.findAllByRole('checkbox')) {
      expect(box).toBeChecked();
      expect(box).toBeDisabled();
    }
    expect(dialog.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('R-03 someone who may only read roles sees them without any buttons to change', async () => {
    renderApp('/roles', { me: meWith(['roles:read']), api: setup() });
    await screen.findByRole('table', { name: 'Roles' });
    expect(screen.queryByRole('button', { name: /new role/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('R-04 creating a role sends the ticked permissions, sorted', async () => {
    const api = setup({ 'POST /v1/admin/roles': roleFixture({ id: 'r-3' }) });
    renderApp('/roles', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new role/i }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New role' }));
    await userEvent.type(dialog.getByLabelText('Name'), 'Desk');
    await userEvent.click(await dialog.findByLabelText('Cancel bookings'));
    await userEvent.click(dialog.getByLabelText('View bookings'));
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.callsTo('POST', '/v1/admin/roles')).toHaveLength(1));
    expect(api.callsTo('POST', '/v1/admin/roles')[0]!.body).toEqual({
      name: 'Desk',
      description: null,
      permissions: ['bookings:cancel', 'bookings:read'],
    });
  });

  it('R-05 a server refusal (privilege escalation) is shown and the dialog stays open', async () => {
    const api = setup({
      'PATCH /v1/admin/roles/:id': problemResponse(
        403,
        'ROLE_ESCALATION',
        'You cannot grant permissions you do not hold',
      ),
    });
    renderApp('/roles', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Roles' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[2]!).getByRole('button', { name: 'Edit' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: /edit support/i }));
    await userEvent.click(await dialog.findByLabelText('Cancel bookings'));
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'You cannot grant permissions you do not hold',
    );
  });

  it('R-06 deleting a role that is in use is refused with the reason', async () => {
    const api = setup({
      'DELETE /v1/admin/roles/:id': problemResponse(409, 'ROLE_IN_USE', 'Role is still assigned'),
    });
    renderApp('/roles', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Roles' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[2]!).getByRole('button', { name: 'Delete' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: /delete role/i }));
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Role is still assigned');
  });
});

describe('staff', () => {
  const setup = (extra: Record<string, unknown> = {}) =>
    mockApi({
      'GET /v1/admin/admins': [
        adminFixture({
          id: 'u-boss',
          email: 'owner@rento.demo',
          displayName: 'Owner',
          roles: [
            { roleId: 'r-super', roleName: 'Super Admin', isSuperAdmin: true, drawerId: null },
          ],
        }),
        adminFixture(),
        adminFixture({
          id: 'u-3',
          email: 'meera@rento.demo',
          displayName: null,
          roles: [{ roleId: 'r-1', roleName: 'Support', isSuperAdmin: false, drawerId: 'd-1' }],
        }),
      ],
      'GET /v1/admin/admins/invitations': [
        {
          id: 'i-1',
          email: 'new@rento.demo',
          invitedBy: 'u-boss',
          expiresAt: '2030-01-14T00:00:00.000Z',
          createdAt: '2030-01-07T00:00:00.000Z',
          roles: [{ roleName: 'Support' }],
        },
      ],
      'GET /v1/admin/roles': [superRole, roleFixture()],
      'GET /v1/admin/drawers': [drawerA],
      ...extra,
    });
  const me = { ...superAdminMe, user: { ...superAdminMe.user, id: 'u-boss' } };

  it('T-01 lists people with their roles (drawer-limited ones say so), and pending invitations', async () => {
    renderApp('/staff', { me, api: setup() });
    const table = await screen.findByRole('table', { name: 'Staff' });
    expect(within(table).getByText('Super Admin')).toBeInTheDocument();
    expect(within(table).getByText(/one drawer only/)).toBeInTheDocument();
    const pending = await screen.findByRole('table', { name: 'Pending invitations' });
    expect(within(pending).getByText('new@rento.demo')).toBeInTheDocument();
  });

  it('T-02 you cannot remove your own access from here', async () => {
    renderApp('/staff', { me, api: setup() });
    const table = await screen.findByRole('table', { name: 'Staff' });
    const own = within(table).getAllByRole('row')[1]!;
    expect(within(own).queryByRole('button', { name: 'Remove access' })).not.toBeInTheDocument();
    expect(
      within(within(table).getAllByRole('row')[2]!).getByRole('button', { name: 'Remove access' }),
    ).toBeInTheDocument();
  });

  it('T-03 read-only viewers of staff get no management buttons and no invitation list', async () => {
    const api = setup();
    renderApp('/staff', { me: meWith(['admins:read']), api });
    await screen.findByRole('table', { name: 'Staff' });
    expect(screen.queryByRole('button', { name: /invite someone/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change roles' })).not.toBeInTheDocument();
    expect(api.callsTo('GET', '/v1/admin/admins/invitations')).toHaveLength(0);
  });

  it('T-04 inviting needs an email and a role, then sends them (null drawer = all drawers)', async () => {
    const api = setup({ 'POST /v1/admin/admins/invitations': { id: 'i-2' } });
    renderApp('/staff', { me, api });
    await userEvent.click(await screen.findByRole('button', { name: /invite someone/i }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Invite someone' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));
    expect(await dialog.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(dialog.getByText('Choose at least one role.')).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/admins/invitations')).toHaveLength(0);

    await userEvent.type(dialog.getByLabelText('Email'), 'priya@rento.demo');
    await userEvent.selectOptions(await dialog.findByLabelText('Role 1'), 'r-1');
    await userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByRole('dialog', { name: 'Invitation sent' })).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/admins/invitations')[0]!.body).toEqual({
      email: 'priya@rento.demo',
      roles: [{ roleId: 'r-1', drawerId: null }],
    });
  });

  it('T-05 a role can be limited to one drawer', async () => {
    const api = setup({ 'POST /v1/admin/admins/invitations': { id: 'i-2' } });
    renderApp('/staff', { me, api });
    await userEvent.click(await screen.findByRole('button', { name: /invite someone/i }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Email'), 'priya@rento.demo');
    await userEvent.selectOptions(await dialog.findByLabelText('Role 1'), 'r-1');
    await userEvent.selectOptions(await dialog.findByLabelText('Drawer 1'), 'd-1');
    await userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));
    await screen.findByRole('dialog', { name: 'Invitation sent' });
    expect(api.callsTo('POST', '/v1/admin/admins/invitations')[0]!.body).toEqual({
      email: 'priya@rento.demo',
      roles: [{ roleId: 'r-1', drawerId: 'd-1' }],
    });
  });

  it('T-06 a taken email is explained by the server', async () => {
    const api = setup({
      'POST /v1/admin/admins/invitations': problemResponse(
        409,
        'EMAIL_TAKEN',
        'An account with this email already exists',
      ),
    });
    renderApp('/staff', { me, api });
    await userEvent.click(await screen.findByRole('button', { name: /invite someone/i }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Email'), 'ravi@rento.demo');
    await userEvent.selectOptions(await dialog.findByLabelText('Role 1'), 'r-1');
    await userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'An account with this email already exists',
    );
  });

  it('T-07 changing roles sends the whole new set; removing the last Super Admin is refused by the server', async () => {
    const api = setup({
      'PUT /v1/admin/admins/:userId/roles': problemResponse(
        409,
        'LAST_SUPER_ADMIN',
        'The last Super Admin cannot be changed',
      ),
    });
    renderApp('/staff', { me, api });
    const table = await screen.findByRole('table', { name: 'Staff' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: 'Change roles' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: /roles of owner/i }));
    await userEvent.click(dialog.getByRole('button', { name: 'Remove role 1' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Save roles' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'The last Super Admin cannot be changed',
    );
    expect(api.callsTo('PUT', '/v1/admin/admins/u-boss/roles')[0]!.body).toEqual({ roles: [] });
  });

  it('T-08 removing access asks for confirmation first', async () => {
    const api = setup({ 'DELETE /v1/admin/admins/:userId': undefined });
    renderApp('/staff', { me, api });
    const table = await screen.findByRole('table', { name: 'Staff' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[2]!).getByRole('button', { name: 'Remove access' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: /remove admin access/i }));
    expect(api.callsTo('DELETE', '/v1/admin/admins/u-2')).toHaveLength(0);
    await userEvent.click(dialog.getByRole('button', { name: 'Remove access' }));
    await waitFor(() => expect(api.callsTo('DELETE', '/v1/admin/admins/u-2')).toHaveLength(1));
  });

  it('T-09 a pending invitation can be cancelled', async () => {
    const api = setup({ 'DELETE /v1/admin/admins/invitations/:id': undefined });
    renderApp('/staff', { me, api });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel invitation' }));
    await waitFor(() =>
      expect(api.callsTo('DELETE', '/v1/admin/admins/invitations/i-1')).toHaveLength(1),
    );
  });
});
