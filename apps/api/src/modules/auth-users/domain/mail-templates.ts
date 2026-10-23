import type { MailMessage } from '../../../common/mail/mail-sender';

// Pure mail templates (no I/O). User-supplied values are HTML-escaped; links are built by the caller.

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const plural = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? '' : 's'}`;

const greetingText = (name: string | null): string => (name ? `Hi ${name},` : 'Hi,');
const greetingHtml = (name: string | null): string => (name ? `Hi ${escapeHtml(name)},` : 'Hi,');

function layout(args: {
  greeting: string;
  paragraphs: string[];
  linkLabel?: string;
  link?: string;
}): string {
  const button =
    args.link && args.linkLabel
      ? `<p><a href="${escapeHtml(args.link)}" style="display:inline-block;padding:10px 18px;background:#0b6e4f;color:#fff;text-decoration:none;border-radius:6px">${escapeHtml(args.linkLabel)}</a></p>` +
        `<p style="color:#555;font-size:13px">If the button does not work, copy this link into your browser:<br>${escapeHtml(args.link)}</p>`
      : '';
  return (
    `<div style="font-family:system-ui,sans-serif;max-width:520px">` +
    `<p>${args.greeting}</p>` +
    args.paragraphs.map((p) => `<p>${p}</p>`).join('') +
    button +
    `<p style="color:#555;font-size:13px">— Rento</p></div>`
  );
}

export function verificationEmail(input: {
  to: string;
  name: string | null;
  link: string;
  ttlHours: number;
}): MailMessage {
  const expiry = `This link works once and expires in ${plural(input.ttlHours, 'hour')}.`;
  const ignore = 'If you did not create a Rento account, you can ignore this email.';
  return {
    to: input.to,
    purpose: 'email_verification',
    subject: 'Verify your email for Rento',
    text: [
      greetingText(input.name),
      '',
      'Please confirm your email address to finish setting up your Rento account:',
      input.link,
      '',
      expiry,
      ignore,
    ].join('\n'),
    html: layout({
      greeting: greetingHtml(input.name),
      paragraphs: [
        'Please confirm your email address to finish setting up your Rento account.',
        expiry,
        ignore,
      ],
      linkLabel: 'Verify email',
      link: input.link,
    }),
  };
}

export function passwordResetEmail(input: {
  to: string;
  name: string | null;
  link: string;
  ttlMinutes: number;
}): MailMessage {
  const expiry = `This link works once and expires in ${plural(input.ttlMinutes, 'minute')}.`;
  const ignore =
    'If you did not ask to reset your password, you can ignore this email — your password stays the same.';
  return {
    to: input.to,
    purpose: 'password_reset',
    subject: 'Reset your Rento password',
    text: [
      greetingText(input.name),
      '',
      'We received a request to reset your Rento password. Choose a new one here:',
      input.link,
      '',
      expiry,
      ignore,
    ].join('\n'),
    html: layout({
      greeting: greetingHtml(input.name),
      paragraphs: ['We received a request to reset your Rento password.', expiry, ignore],
      linkLabel: 'Reset password',
      link: input.link,
    }),
  };
}

export function passwordChangedEmail(input: { to: string; name: string | null }): MailMessage {
  const warning =
    'If this was not you, reset your password again straight away and contact support — someone else may have access to your email.';
  return {
    to: input.to,
    purpose: 'password_changed',
    subject: 'Your Rento password was changed',
    text: [
      greetingText(input.name),
      '',
      'The password for your Rento account was just changed, and you were signed out of all devices.',
      warning,
    ].join('\n'),
    html: layout({
      greeting: greetingHtml(input.name),
      paragraphs: [
        'The password for your Rento account was just changed, and you were signed out of all devices.',
        warning,
      ],
    }),
  };
}

export function adminInvitationEmail(input: {
  to: string;
  inviterName: string | null;
  roleNames: string[];
  link: string;
  ttlHours: number;
}): MailMessage {
  const who = input.inviterName ? input.inviterName : 'A Rento administrator';
  const roles = input.roleNames.length > 0 ? ` as ${input.roleNames.join(', ')}` : '';
  const expiry = `This link works once and expires in ${plural(input.ttlHours, 'hour')}.`;
  const ignore = 'If you were not expecting this invitation, you can ignore this email.';
  return {
    to: input.to,
    purpose: 'admin_invitation',
    subject: 'You have been invited to the Rento admin panel',
    text: [
      'Hi,',
      '',
      `${who} invited you to the Rento admin panel${roles}. Accept the invitation and set up your sign-in here:`,
      input.link,
      '',
      expiry,
      ignore,
    ].join('\n'),
    html: layout({
      greeting: 'Hi,',
      paragraphs: [
        `${escapeHtml(who)} invited you to the Rento admin panel${escapeHtml(roles)}.`,
        expiry,
        ignore,
      ],
      linkLabel: 'Accept invitation',
      link: input.link,
    }),
  };
}
