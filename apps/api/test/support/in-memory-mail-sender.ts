import type { MailMessage, MailSender } from '../../src/common/mail/mail-sender';

/** Collects outgoing mail; can be told to fail or to hang so tests can prove the request path never depends on it. */
export class InMemoryMailSender implements MailSender {
  readonly sent: MailMessage[] = [];
  /** When set, `send` rejects with this error. */
  failWith: Error | undefined;
  /** When true, `send` waits until `release()` — simulates an unreachable mail server. */
  hang = false;
  private readonly waiting: Array<() => void> = [];

  /** Ends a simulated hang: pending sends complete and are recorded. */
  release(): void {
    this.hang = false;
    for (const resolve of this.waiting.splice(0)) resolve();
  }

  async send(message: MailMessage): Promise<void> {
    if (this.hang) await new Promise<void>((resolve) => this.waiting.push(resolve));
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
  }

  to(email: string): MailMessage[] {
    return this.sent.filter((m) => m.to.toLowerCase() === email.toLowerCase());
  }

  /** Mail to `email` whose subject contains `subjectPart`. */
  find(email: string, subjectPart: string): MailMessage[] {
    return this.to(email).filter((m) =>
      m.subject.toLowerCase().includes(subjectPart.toLowerCase()),
    );
  }

  clear(): void {
    this.sent.length = 0;
  }
}

/** Extracts the single-use token from the link in a mail (`...?token=<token>`). */
export function tokenFromMail(message: MailMessage): string {
  const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(message.text);
  if (!match?.[1]) throw new Error(`no token link in mail "${message.subject}"`);
  return match[1];
}
