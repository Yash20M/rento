import type { ErrorCode } from './error-codes';

export interface FieldError {
  field: string;
  message: string;
}

/** Domain/application error. The global filter turns it into RFC 9457 problem+json. */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly errors: FieldError[] | undefined;
  /** Extra response headers (for example `retry-after` on a 429). */
  readonly headers: Record<string, string> | undefined;

  constructor(options: {
    status: number;
    code: ErrorCode;
    detail: string;
    errors?: FieldError[] | undefined;
    headers?: Record<string, string> | undefined;
  }) {
    super(options.detail);
    this.name = 'AppError';
    this.status = options.status;
    this.code = options.code;
    this.errors = options.errors;
    this.headers = options.headers;
  }
}
