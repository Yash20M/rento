import { type DestinationStream, type Logger, pino } from 'pino';
import type { AppConfig } from '../../config/app-config';

/** Structured JSON logger. Secrets are redacted by path; never log tokens, passwords or coordinates. */
export function createLogger(
  config: Pick<AppConfig, 'logLevel'>,
  destination?: DestinationStream,
): Logger {
  return pino(
    {
      level: config.logLevel,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[redacted]',
      },
      serializers: { err: pino.stdSerializers.err },
    },
    destination,
  );
}
