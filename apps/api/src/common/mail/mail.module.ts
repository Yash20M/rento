import { Global, Logger, Module } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { LogOnlyMailSender } from './log-only-mail-sender';
import { MAIL_SENDER, type MailSender } from './mail-sender';
import { SmtpMailSender } from './smtp-mail-sender';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_SENDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): MailSender =>
        config.smtpHost === undefined
          ? new LogOnlyMailSender(new Logger('Mail'))
          : new SmtpMailSender(config),
    },
  ],
  exports: [MAIL_SENDER],
})
export class MailModule {}
