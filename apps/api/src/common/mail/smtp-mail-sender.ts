import nodemailer, { type Transporter } from 'nodemailer';
import type { AppConfig } from '../../config/app-config';
import type { MailMessage, MailSender } from './mail-sender';

export type SmtpSettings = Pick<AppConfig, 'mailFrom'> &
  Partial<
    Pick<
      AppConfig,
      'smtpHost' | 'smtpPort' | 'smtpSecure' | 'smtpUser' | 'smtpPassword' | 'nodeEnv'
    >
  >;

/** Builds the SMTP transport. Timeouts keep a dead mail server from holding resources for long. */
export function createSmtpTransport(settings: SmtpSettings): Transporter {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort ?? 1025,
    secure: settings.smtpSecure ?? false,
    // With implicit TLS off, production must still upgrade the connection (STARTTLS) before authenticating.
    requireTLS: settings.nodeEnv === 'production' && !settings.smtpSecure,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 15_000,
    ...(settings.smtpUser !== undefined && settings.smtpPassword !== undefined
      ? { auth: { user: settings.smtpUser, pass: settings.smtpPassword } }
      : {}),
  });
}

export class SmtpMailSender implements MailSender {
  private readonly transport: Transporter;

  constructor(
    private readonly settings: SmtpSettings,
    transport?: Transporter,
  ) {
    this.transport = transport ?? createSmtpTransport(settings);
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.settings.mailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
