import nodemailer from 'nodemailer';
import { describe, expect, it, vi } from 'vitest';
import { LogOnlyMailSender } from '../../src/common/mail/log-only-mail-sender';
import { SmtpMailSender } from '../../src/common/mail/smtp-mail-sender';
import {
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
} from '../../src/modules/auth-users/domain/mail-templates';

const link = 'https://app.rento.example/verify-email?token=abc_DEF-123';

describe('mail templates', () => {
  it('U-02a verification mail carries the link, the expiry, and the recipient — and nothing else', () => {
    const mail = verificationEmail({ to: 'asha@example.com', name: 'Asha', link, ttlHours: 24 });

    expect(mail.to).toBe('asha@example.com');
    expect(mail.subject).toMatch(/verify/i);
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain(link);
      expect(body).toMatch(/24 hours/);
      expect(body).toMatch(/did not|didn't|ignore/i);
    }
    expect(mail.purpose).toBe('email_verification');
  });

  it('U-02b reset mail carries the link and a minutes-based expiry', () => {
    const mail = passwordResetEmail({
      to: 'asha@example.com',
      name: 'Asha',
      link: 'https://app.rento.example/reset-password?token=zzz',
      ttlMinutes: 60,
    });

    expect(mail.subject).toMatch(/reset/i);
    expect(mail.text).toContain('reset-password?token=zzz');
    expect(mail.text).toMatch(/60 minutes/);
    expect(mail.purpose).toBe('password_reset');
  });

  it('U-02c password-changed notice has no link and tells the user what to do if it was not them', () => {
    const mail = passwordChangedEmail({ to: 'asha@example.com', name: 'Asha' });

    expect(mail.text).not.toMatch(/https?:\/\//);
    expect(mail.text).toMatch(/not you|did not|didn't/i);
    expect(mail.purpose).toBe('password_changed');
  });

  it('U-02d user-supplied values are HTML-escaped (no markup injection through the name)', () => {
    const mail = verificationEmail({
      to: 'a@example.com',
      name: '<script>alert(1)</script> & "Co"',
      link,
      ttlHours: 24,
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('&amp;');
  });

  it('U-02e a missing name falls back to a neutral greeting', () => {
    const mail = verificationEmail({ to: 'a@example.com', name: null, link, ttlHours: 24 });
    expect(mail.text).toMatch(/^Hi,/);
  });
});

describe('SmtpMailSender', () => {
  it('U-03 hands the configured From and the message to the transport', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transport, 'sendMail');
    const sender = new SmtpMailSender({ mailFrom: 'Rento <no-reply@rento.example>' }, transport);

    await sender.send({
      to: 'asha@example.com',
      subject: 'Hello',
      text: 'plain',
      html: '<p>html</p>',
      purpose: 'email_verification',
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'Rento <no-reply@rento.example>',
      to: 'asha@example.com',
      subject: 'Hello',
      text: 'plain',
      html: '<p>html</p>',
    });
  });

  it('U-03b transport errors propagate to the caller (the dispatcher decides what to do)', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    vi.spyOn(transport, 'sendMail').mockRejectedValue(new Error('connection refused'));
    const sender = new SmtpMailSender({ mailFrom: 'x@y.z' }, transport);

    await expect(
      sender.send({ to: 'a@b.c', subject: 's', text: 't', html: 'h', purpose: 'password_reset' }),
    ).rejects.toThrow('connection refused');
  });
});

describe('LogOnlyMailSender', () => {
  it('U-04 logs the purpose only — never the recipient, subject or body', async () => {
    const lines: string[] = [];
    const sender = new LogOnlyMailSender({ warn: (message: string) => void lines.push(message) });

    await sender.send({
      to: 'secret.person@example.com',
      subject: 'Reset your password',
      text: 'https://app.rento.example/reset-password?token=SUPERSECRET',
      html: '<p>SUPERSECRET</p>',
      purpose: 'password_reset',
    });

    const logged = lines.join('\n');
    expect(logged).toContain('password_reset');
    expect(logged).not.toContain('secret.person');
    expect(logged).not.toContain('SUPERSECRET');
    expect(logged).not.toContain('Reset your password');
  });
});
