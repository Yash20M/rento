import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthMailService } from '../../src/modules/auth-users/services/auth-mail.service';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

// Real SMTP end to end: the API sends through nodemailer to a real Mailpit server, and the test reads the message
// back over Mailpit's HTTP API. Covers what the in-memory sender cannot: the actual wire format.

const PASSWORD = 'correct horse battery staple';
const WEB = 'https://app.rento.example';

interface MailpitMessage {
  ID: string;
  Subject: string;
  From: { Address: string; Name: string };
  To: Array<{ Address: string }>;
}
interface MailpitDetail extends MailpitMessage {
  Text: string;
  HTML: string;
}

let mailpit: StartedTestContainer;
let database: TestDatabase;
let current: TestApp;
let apiBase: string;
let counter = 0;

beforeAll(async () => {
  mailpit = await new GenericContainer('axllent/mailpit:v1.27.11')
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forHttp('/readyz', 8025))
    .start();
  // 'localhost' can resolve to ::1 first, which Docker Desktop on Windows answers slowly; the IPv4 address is direct.
  const smtpHost = mailpit.getHost() === 'localhost' ? '127.0.0.1' : mailpit.getHost();
  apiBase = `http://${smtpHost}:${mailpit.getMappedPort(8025)}/api/v1`;

  database = await createTestDatabase();
  current = await createTestApp({
    config: testConfig({
      DATABASE_URL: database.url,
      PUBLIC_WEB_URL: WEB,
      SMTP_HOST: smtpHost,
      SMTP_PORT: String(mailpit.getMappedPort(1025)),
      MAIL_FROM: 'Rento <no-reply@rento.example>',
    }),
    // use the real SMTP sender, not the in-memory default
    realMail: true,
  });
}, 120_000);

afterAll(async () => {
  await current?.app.close();
  await database?.drop();
  await mailpit?.stop();
});

const uniqueEmail = () => `smtp-${(counter += 1)}-${Date.now()}@example.com`;
const post = (url: string, payload?: Record<string, unknown>) =>
  current.app.inject({ method: 'POST', url, ...(payload !== undefined && { payload }) });
const drain = () => current.app.get(AuthMailService).drain();

async function messagesTo(email: string): Promise<MailpitMessage[]> {
  const response = await fetch(`${apiBase}/search?query=${encodeURIComponent(`to:${email}`)}`);
  const body = (await response.json()) as { messages: MailpitMessage[] };
  return body.messages;
}
/** Mail is sent in the background; poll until the message has really arrived instead of trusting a fixed delay. */
async function waitForSubject(email: string, subject: string): Promise<MailpitMessage[]> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const messages = await messagesTo(email);
    if (messages.some((m) => m.Subject === subject) || Date.now() > deadline) return messages;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
async function detail(id: string): Promise<MailpitDetail> {
  return (await (await fetch(`${apiBase}/message/${id}`)).json()) as MailpitDetail;
}
const tokenIn = (text: string): string => {
  const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(text);
  if (!match?.[1]) throw new Error('no token link in mail');
  return match[1];
};

// Real containers + Argon2 under a parallel test run: the 5 s default is too tight and made this flaky.
describe('real SMTP delivery (Mailpit)', { timeout: 30_000 }, () => {
  it('I-01 registration delivers a verification mail whose link verifies the address', async () => {
    const email = uniqueEmail();
    const registered = await post('/v1/auth/register', { email, password: PASSWORD, name: 'Asha' });
    expect(registered.statusCode).toBe(201);
    await drain();

    const [summary, ...rest] = await waitForSubject(email, 'Verify your email for Rento');
    expect(rest).toHaveLength(0);
    expect(summary?.Subject).toBe('Verify your email for Rento');
    expect(summary?.From.Address).toBe('no-reply@rento.example');
    expect(summary?.From.Name).toBe('Rento');

    const mail = await detail(summary!.ID);
    expect(mail.Text).toContain(`${WEB}/verify-email?token=`);
    expect(mail.HTML).toContain(`${WEB}/verify-email?token=`);

    const verified = await post('/v1/auth/email/verify', { token: tokenIn(mail.Text) });
    expect(verified.statusCode).toBe(204);
  });

  it('I-02 forgot → reset round trip over real SMTP, ending with a "password changed" notice', async () => {
    const email = uniqueEmail();
    await post('/v1/auth/register', { email, password: PASSWORD, name: 'Asha' });
    await drain();

    expect((await post('/v1/auth/password/forgot', { email })).statusCode).toBe(202);
    await drain();
    const reset = (await waitForSubject(email, 'Reset your Rento password')).find(
      (m) => m.Subject === 'Reset your Rento password',
    );
    expect(reset).toBeDefined();
    const token = tokenIn((await detail(reset!.ID)).Text);

    const done = await post('/v1/auth/password/reset', {
      token,
      newPassword: 'a brand new passphrase 2030',
    });
    expect(done.statusCode).toBe(204);
    await drain();

    const subjects = (await waitForSubject(email, 'Your Rento password was changed')).map(
      (m) => m.Subject,
    );
    expect(subjects).toContain('Your Rento password was changed');
  });

  it('I-03 an address that is not registered receives nothing', async () => {
    const email = uniqueEmail();
    expect((await post('/v1/auth/password/forgot', { email })).statusCode).toBe(202);
    await drain();
    expect(await messagesTo(email)).toHaveLength(0);
  });
});
