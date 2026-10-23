import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

/** M25 — "My account": the signed-in administrator's own details, photo and password. */
const MEDIA = '/v1/media/44444444-4444-4444-8444-444444444444';
const profile = (over: Record<string, unknown> = {}) => ({
  id: 'u-boss',
  email: 'owner@rento.demo',
  displayName: 'Owner',
  phone: '+919876543210',
  emailVerified: true,
  avatarUrl: null,
  needsProfileCompletion: [],
  ...over,
});
const png = (size = 20, type = 'image/png') => new File([new Uint8Array(size)], 'me.png', { type });
const user = userEvent.setup({ applyAccept: false });

const setup = (extra: Record<string, unknown> = {}, me = superAdminMe) => {
  const api = mockApi({
    'GET /v1/me': profile(),
    'GET /v1/auth/session/mfa': { enrolled: false, recoveryCodesLeft: 0 },
    ...extra,
  } as never);
  renderApp('/account', { me, api });
  return api;
};

describe('my account', () => {
  it('AC-01 the header shows who is signed in and links to this page, for every role', async () => {
    setup({}, meWith(['bookings:read']));
    const link = await screen.findByRole('link', { name: /my account/i });
    expect(link).toHaveAttribute('href', '/account');
    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument();
  });

  it('AC-02 shows the details, the verified email, and an Add photo button when there is none', async () => {
    setup();
    expect(await screen.findByLabelText('Name')).toHaveValue('Owner');
    expect(screen.getByLabelText('Phone')).toHaveValue('+919876543210');
    expect(screen.getByText('owner@rento.demo')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Email verified' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add photo…' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();
  });

  it('AC-03 saving sends only what changed and confirms; nothing changed means nothing to save', async () => {
    const api = setup({ 'PATCH /v1/me': profile({ displayName: 'Owner Two' }) });
    const name = await screen.findByLabelText('Name');
    const save = screen.getByRole('button', { name: 'Save details' });
    expect(save).toBeDisabled();
    await user.clear(name);
    await user.type(name, 'Owner Two');
    await user.click(save);
    await screen.findByRole('status');
    const call = api.calls.find((c) => c.method === 'PATCH' && c.path === '/v1/me')!;
    expect(call.body).toEqual({ name: 'Owner Two' });
  });

  it('AC-04 a refused phone number is explained next to the field', async () => {
    setup({
      'PATCH /v1/me': problemResponse(422, 'VALIDATION_FAILED', 'Request validation failed', [
        { field: 'phone', message: 'must be a valid phone number' },
      ]),
    });
    const phone = await screen.findByLabelText('Phone');
    await user.clear(phone);
    await user.type(phone, '123');
    await user.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('must be a valid phone number')).toBeInTheDocument();
  });

  it('AC-05 a chosen picture is sent as the body with its own type and then shown; wrong type or size is refused first', async () => {
    let photo: string | null = null;
    const api = mockApi({
      'GET /v1/me': () => profile({ avatarUrl: photo }),
      'GET /v1/auth/session/mfa': { enrolled: false, recoveryCodesLeft: 0 },
      'POST /v1/me/avatar': () => {
        photo = MEDIA;
        return profile({ avatarUrl: MEDIA });
      },
    } as never);
    renderApp('/account', { me: superAdminMe, api });
    const input = await screen.findByLabelText('Choose profile photo');

    await user.upload(input, png(10, 'application/pdf'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/only JPEG, PNG or WebP/i);
    await user.upload(input, png(2 * 1024 * 1024 + 1));
    expect(await screen.findByRole('alert')).toHaveTextContent(/larger than 2 MB/i);
    expect(api.calls.some((c) => c.method === 'POST' && c.path === '/v1/me/avatar')).toBe(false);

    await user.upload(input, png());
    await screen.findByRole('button', { name: 'Change photo…' });
    const call = api.calls.find((c) => c.method === 'POST' && c.path === '/v1/me/avatar')!;
    expect(call.headers.get('content-type')).toBe('image/png');
  });

  it('AC-06 removing the photo asks the server and goes back to the initial', async () => {
    let photo: string | null = MEDIA;
    const api = mockApi({
      'GET /v1/me': () => profile({ avatarUrl: photo }),
      'GET /v1/auth/session/mfa': { enrolled: false, recoveryCodesLeft: 0 },
      'DELETE /v1/me/avatar': () => {
        photo = null;
        return profile();
      },
    } as never);
    renderApp('/account', { me: superAdminMe, api });
    await user.click(await screen.findByRole('button', { name: 'Remove photo' }));
    await screen.findByRole('button', { name: 'Add photo…' });
    expect(api.calls.some((c) => c.method === 'DELETE' && c.path === '/v1/me/avatar')).toBe(true);
  });
});

describe('changing the password', () => {
  const fill = async (current: string, next: string, again = next) => {
    await user.type(await screen.findByLabelText('Current password'), current);
    await user.type(screen.getByLabelText('New password'), next);
    await user.type(screen.getByLabelText('New password again'), again);
  };

  it('AC-07 the button waits for all three boxes, and two different new passwords are called out', async () => {
    setup();
    const button = await screen.findByRole('button', { name: 'Change password' });
    expect(button).toBeDisabled();
    await fill('old password here', 'a long new passphrase', 'a long new passphrasX');
    expect(screen.getByText('The two passwords are different.')).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('AC-08 a wrong current password is explained and nothing signs out', async () => {
    setup({
      'POST /v1/me/password': problemResponse(401, 'UNAUTHENTICATED', 'Invalid email or password'),
    });
    await fill('wrong', 'a long new passphrase');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
  });

  it('AC-09 success sends both passwords, says every session ended, and leads to sign in', async () => {
    const api = setup({ 'POST /v1/me/password': new Response(null, { status: 204 }) });
    await fill('old password here', 'a long new passphrase');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText(/every session was signed out/i)).toBeInTheDocument();
    const call = api.calls.find((c) => c.method === 'POST' && c.path === '/v1/me/password')!;
    expect(call.body).toEqual({
      currentPassword: 'old password here',
      newPassword: 'a long new passphrase',
    });
    await user.click(screen.getByRole('button', { name: 'Go to sign in' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument(),
    );
  });
});
