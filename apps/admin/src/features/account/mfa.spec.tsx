import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { permissionGroups, roleFixture, superRole } from '@/test/fixtures';
import { jsonResponse, mockApi } from '@/test/mock-api';
import { problemResponse, renderApp, superAdminMe } from '@/test/render';

/** P4-05 — two-step verification in the admin panel: the gate, the code, setting it up, and the step-up question. */
const meWithMfa = (mfa: { required: boolean; enrolled: boolean; verified: boolean }) => ({
  ...superAdminMe,
  mfa,
});
const session = { accessToken: 'upgraded', tokenType: 'Bearer', expiresIn: 900 };
const profile = {
  id: 'u-boss',
  email: 'owner@rento.demo',
  displayName: 'Owner',
  phone: null,
  emailVerified: true,
  avatarUrl: null,
  needsProfileCompletion: [],
};
const user = userEvent.setup();

describe('the gate', () => {
  it('G-01 required and not set up: only the setup screen, no menu, and a way to sign out', async () => {
    renderApp('/', {
      me: meWithMfa({ required: true, enrolled: false, verified: false }),
      api: mockApi(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Set up two-step verification' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('G-02 set up but not proved this session: asks for the code; a wrong one is explained, a right one opens the panel', async () => {
    let proved = false;
    const api = mockApi({
      'POST /v1/auth/session/mfa/verify': (request: { body: unknown }) => {
        if ((request.body as { code?: string }).code !== '123456') {
          return problemResponse(422, 'VALIDATION_FAILED', 'Request validation failed', [
            { field: 'code', message: 'That code is not right.' },
          ]);
        }
        proved = true;
        return jsonResponse(session);
      },
      'GET /v1/admin/dashboard': {},
    } as never);
    renderApp('/', {
      me: () => meWithMfa({ required: true, enrolled: true, verified: proved }),
      api,
    });
    const box = await screen.findByLabelText('Code from your authenticator app');
    await user.type(box, '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('That code is not right.')).toBeInTheDocument();

    await user.clear(box);
    await user.type(box, '123 456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument(),
    );
    const sent = api.calls.filter((c) => c.path === '/v1/auth/session/mfa/verify');
    expect(sent.at(-1)!.body).toEqual({ code: '123456' }); // spaces are forgiven
  });

  it('G-03 a lost phone: a recovery code is sent instead of the app code', async () => {
    const api = mockApi({
      'POST /v1/auth/session/mfa/verify': () => jsonResponse(session),
    } as never);
    renderApp('/', {
      me: meWithMfa({ required: true, enrolled: true, verified: false }),
      api,
    });
    await user.click(await screen.findByRole('button', { name: /lost your phone/i }));
    await user.type(screen.getByLabelText('Recovery code'), 'ABCDE-FGHJK');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(api.callsTo('POST', '/v1/auth/session/mfa/verify')).toHaveLength(1));
    expect(api.callsTo('POST', '/v1/auth/session/mfa/verify')[0]!.body).toEqual({
      recoveryCode: 'ABCDE-FGHJK',
    });
  });

  it('G-04 when it is not required (or already proved) nothing is in the way', async () => {
    renderApp('/', { me: superAdminMe, api: mockApi() });
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});

describe('setting it up', () => {
  it('E-01 password → scan and type the first code → ten recovery codes, shown once, kept before finishing', async () => {
    const api = mockApi({
      'GET /v1/me': profile,
      'GET /v1/auth/session/mfa': { enrolled: false, recoveryCodesLeft: 0 },
      'POST /v1/auth/session/mfa/enrol': {
        secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
        otpauthUri: 'otpauth://totp/Rento:owner%40rento.demo?secret=GEZDGNBVGY3TQOJQ',
      },
      'POST /v1/auth/session/mfa/enrol/confirm': {
        ...session,
        recoveryCodes: Array.from({ length: 10 }, (_, i) => `CODE${i}-ABCDE`),
      },
    } as never);
    renderApp('/account', { me: superAdminMe, api });
    await user.click(await screen.findByRole('button', { name: 'Set up' }));
    await user.type(screen.getByLabelText('Your password'), 'my password');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /qr code/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText('First code from the app'), '123456');
    await user.click(screen.getByRole('button', { name: 'Turn on' }));

    const list = await screen.findByRole('list', { name: 'Recovery codes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    await user.click(screen.getByLabelText(/saved my recovery codes/i));
    expect(done).toBeEnabled();
    expect(api.callsTo('POST', '/v1/auth/session/mfa/enrol')[0]!.body).toEqual({
      password: 'my password',
    });
    expect(api.callsTo('POST', '/v1/auth/session/mfa/enrol/confirm')[0]!.body).toEqual({
      code: '123456',
    });
  });

  it('E-02 a wrong password stops at the first step with the reason', async () => {
    const api = mockApi({
      'GET /v1/me': profile,
      'GET /v1/auth/session/mfa': { enrolled: false, recoveryCodesLeft: 0 },
      'POST /v1/auth/session/mfa/enrol': problemResponse(
        401,
        'UNAUTHENTICATED',
        'Invalid email or password',
      ),
    } as never);
    renderApp('/account', { me: superAdminMe, api });
    await user.click(await screen.findByRole('button', { name: 'Set up' }));
    await user.type(screen.getByLabelText('Your password'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.queryByLabelText('First code from the app')).not.toBeInTheDocument();
  });
});

describe('the two-step card', () => {
  const status = (enrolled: boolean, left = 10) =>
    ({
      'GET /v1/me': profile,
      'GET /v1/auth/session/mfa': { enrolled, recoveryCodesLeft: left },
    }) as never;

  it('C-01 off: offers to set it up', async () => {
    renderApp('/account', { me: superAdminMe, api: mockApi(status(false)) });
    expect(await screen.findByTestId('mfa-state')).toHaveTextContent(/^Off/);
    expect(screen.getByRole('button', { name: 'Set up' })).toBeInTheDocument();
  });

  it('C-02 on and optional: shows the codes left, new codes, and a way to turn it off', async () => {
    renderApp('/account', { me: superAdminMe, api: mockApi(status(true, 7)) });
    expect(await screen.findByTestId('mfa-state')).toHaveTextContent('On. 7 recovery codes left.');
    expect(screen.getByRole('button', { name: /new recovery codes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /turn off/i })).toBeInTheDocument();
  });

  it('C-03 on and required: it cannot be turned off, and the page says who can help with a lost phone', async () => {
    renderApp('/account', {
      me: meWithMfa({ required: true, enrolled: true, verified: true }),
      api: mockApi(status(true, 1)),
    });
    expect(await screen.findByTestId('mfa-state')).toHaveTextContent('On. 1 recovery code left.');
    expect(screen.queryByRole('button', { name: /turn off/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ask another administrator/i)).toBeInTheDocument();
  });
});

describe('the step-up question', () => {
  it('S-01 a sensitive action that needs a fresh code asks for it, then carries on by itself', async () => {
    let attempts = 0;
    const api = mockApi({
      'GET /v1/admin/roles': [superRole, roleFixture()],
      'GET /v1/admin/permissions': permissionGroups,
      'POST /v1/admin/roles': () => {
        attempts += 1;
        return attempts === 1
          ? problemResponse(403, 'STEP_UP_REQUIRED', 'Confirm it is you')
          : roleFixture({ id: 'r-9', name: 'Desk' });
      },
      'POST /v1/auth/session/mfa/verify': () => jsonResponse(session),
    } as never);
    renderApp('/roles', { me: superAdminMe, api });
    await user.click(await screen.findByRole('button', { name: /new role/i }));
    const form = within(await screen.findByRole('dialog', { name: 'New role' }));
    await user.type(form.getByLabelText('Name'), 'Desk');
    await user.click(await form.findByLabelText('View bookings'));
    await user.click(form.getByRole('button', { name: 'Save' }));

    const ask = within(await screen.findByRole('dialog', { name: 'Confirm it is you' }));
    await user.type(ask.getByLabelText('Code from your authenticator app'), '654321');
    await user.click(ask.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(attempts).toBe(2)); // repeated automatically with the upgraded token
    const posts = api.callsTo('POST', '/v1/admin/roles');
    expect(posts).toHaveLength(2);
    expect(posts[1]!.authorization).toBe('Bearer upgraded');
    expect(posts[1]!.body).toEqual(posts[0]!.body);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Confirm it is you' })).not.toBeInTheDocument(),
    );
  });

  it('S-02 closing the question without a code leaves the action refused, with the reason', async () => {
    const api = mockApi({
      'GET /v1/admin/roles': [superRole, roleFixture()],
      'GET /v1/admin/permissions': permissionGroups,
      'POST /v1/admin/roles': problemResponse(403, 'STEP_UP_REQUIRED', 'Confirm it is you'),
    } as never);
    renderApp('/roles', { me: superAdminMe, api });
    await user.click(await screen.findByRole('button', { name: /new role/i }));
    const form = within(await screen.findByRole('dialog', { name: 'New role' }));
    await user.type(form.getByLabelText('Name'), 'Desk');
    await user.click(await form.findByLabelText('View bookings'));
    await user.click(form.getByRole('button', { name: 'Save' }));

    await screen.findByRole('dialog', { name: 'Confirm it is you' });
    await user.keyboard('{Escape}');
    expect(await screen.findByText(/confirm it is you/i)).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/roles')).toHaveLength(1);
  });
});
