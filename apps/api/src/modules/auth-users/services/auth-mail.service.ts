import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { MAIL_SENDER, type MailMessage, type MailSender } from '../../../common/mail/mail-sender';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';

const DRAIN_TIMEOUT_MS = 5_000;

const errorLabel = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) return 'unknown';
  const { name, code } = error as { name?: unknown; code?: unknown };
  return [typeof name === 'string' ? name : 'Error', typeof code === 'string' ? code : '']
    .filter(Boolean)
    .join('/');
};

/**
 * Sends account mail **off the request path**. The HTTP handler returns immediately, so response time can never
 * reveal whether an address has an account, and a slow or failing mail server cannot break sign-up or recovery.
 * Failures are logged by purpose and error class only — never the recipient, link or token.
 *
 * (Planned: replace with the transactional outbox + retries — P2-23 / P2-30.)
 */
@Injectable()
export class AuthMailService implements OnApplicationShutdown {
  private readonly logger = new Logger(AuthMailService.name);
  private readonly pending = new Set<Promise<void>>();

  constructor(
    @Inject(MAIL_SENDER) private readonly sender: MailSender,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** `${PUBLIC_WEB_URL}${path}?token=<token>` — the link in the mail. */
  link(path: string, token: string): string {
    return `${this.config.publicWebUrl}${path}?token=${encodeURIComponent(token)}`;
  }

  /** Runs `job` in the background; any error is logged (label only) and swallowed. */
  background(label: string, job: () => Promise<void>): void {
    const run: Promise<void> = Promise.resolve()
      .then(job)
      .catch((error: unknown) => {
        this.logger.warn(`background task failed (task=${label}, error=${errorLabel(error)})`);
      })
      .finally(() => {
        this.pending.delete(run);
      });
    this.pending.add(run);
  }

  /** Delivers one message; a transport failure is logged and does not propagate. */
  async deliver(message: MailMessage): Promise<void> {
    try {
      await this.sender.send(message);
    } catch (error) {
      this.logger.warn(
        `mail delivery failed (purpose=${message.purpose}, error=${errorLabel(error)})`,
      );
    }
  }

  /** Resolves when all background work started so far has finished (or after a bounded wait). */
  async drain(timeoutMs = DRAIN_TIMEOUT_MS): Promise<void> {
    if (this.pending.size === 0) return;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    try {
      await Promise.race([Promise.allSettled([...this.pending]).then(() => undefined), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.drain();
  }
}
