import type { LoggerService } from '@nestjs/common';
import type { Logger } from 'pino';

type Level = 'info' | 'error' | 'warn' | 'debug' | 'trace' | 'fatal';

/** Routes the framework's internal logging into the shared pino instance (one JSON stream). */
export class NestPinoLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, ...rest: unknown[]): void {
    this.write('info', message, rest);
  }
  error(message: unknown, ...rest: unknown[]): void {
    this.write('error', message, rest);
  }
  warn(message: unknown, ...rest: unknown[]): void {
    this.write('warn', message, rest);
  }
  debug(message: unknown, ...rest: unknown[]): void {
    this.write('debug', message, rest);
  }
  verbose(message: unknown, ...rest: unknown[]): void {
    this.write('trace', message, rest);
  }
  fatal(message: unknown, ...rest: unknown[]): void {
    this.write('fatal', message, rest);
  }

  private write(level: Level, message: unknown, rest: unknown[]): void {
    const last = rest.at(-1);
    const bindings = typeof last === 'string' ? { context: last } : {};
    this.logger[level](bindings, typeof message === 'string' ? message : JSON.stringify(message));
  }
}
