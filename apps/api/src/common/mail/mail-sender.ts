export const MAIL_SENDER = Symbol('MAIL_SENDER');

/** Why a mail is being sent. Used for logging and tests — never the recipient or content. */
export type MailPurpose =
  | 'email_verification'
  | 'password_reset'
  | 'password_changed'
  | 'admin_invitation'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_expired'
  | 'booking_reminder';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  purpose: MailPurpose;
}

/**
 * Outgoing email seam. Implementations: SMTP (Mailpit locally, the chosen provider in production — P0-05),
 * a log-only fallback for development without SMTP, and an in-memory sender in tests.
 */
export interface MailSender {
  send(message: MailMessage): Promise<void>;
}
