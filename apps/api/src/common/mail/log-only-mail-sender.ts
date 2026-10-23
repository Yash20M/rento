import type { MailMessage, MailSender } from './mail-sender';

/**
 * Development fallback when no SMTP server is configured: nothing is delivered. It logs only the purpose — never
 * the recipient, subject, link or token — so even local logs cannot leak a reset link.
 */
export class LogOnlyMailSender implements MailSender {
  constructor(private readonly logger: { warn(message: string): void }) {}

  async send(message: MailMessage): Promise<void> {
    this.logger.warn(
      `mail not delivered: SMTP_HOST is not configured (purpose=${message.purpose})`,
    );
  }
}
