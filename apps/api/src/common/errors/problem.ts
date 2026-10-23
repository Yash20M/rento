import { STATUS_CODES } from 'node:http';
import { HttpException } from '@nestjs/common';
import { AppError, type FieldError } from './app-error';
import { ErrorCode } from './error-codes';

/** RFC 9457 problem details with Rento's stable `code` and `traceId` extensions (README §14.1). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail: string;
  errors?: FieldError[];
  traceId: string;
}

const GENERIC_DETAIL = 'An unexpected error occurred.';

const problemType = (code: ErrorCode): string =>
  `urn:rento:problem:${code.toLowerCase().replaceAll('_', '-')}`;

const titleFor = (status: number): string => STATUS_CODES[status] ?? 'Error';

function codeForHttpStatus(status: number): ErrorCode {
  switch (status) {
    case 401:
      return ErrorCode.UNAUTHENTICATED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 429:
      return ErrorCode.RATE_LIMITED;
    case 503:
      return ErrorCode.RETRY_LATER;
    default:
      return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.VALIDATION_FAILED;
  }
}

function httpExceptionDetail(exception: HttpException): string {
  const body = exception.getResponse();
  const message = typeof body === 'string' ? body : (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join('; ');
  return typeof message === 'string' && message.length > 0 ? message : exception.message;
}

function isFastifyClientError(value: unknown): value is { statusCode: number; code: string } {
  if (typeof value !== 'object' || value === null) return false;
  const { statusCode, code } = value as { statusCode?: unknown; code?: unknown };
  return (
    typeof statusCode === 'number' &&
    statusCode >= 400 &&
    statusCode < 500 &&
    typeof code === 'string' &&
    code.startsWith('FST_')
  );
}

function build(
  status: number,
  code: ErrorCode,
  detail: string,
  traceId: string,
  errors?: FieldError[],
): ProblemDetails {
  return {
    type: problemType(code),
    title: titleFor(status),
    status,
    code,
    detail,
    ...(errors !== undefined && { errors }),
    traceId,
  };
}

/** Pure mapping from any thrown value to a problem document. Never exposes unexpected error text. */
export function toProblem(exception: unknown, traceId: string): ProblemDetails {
  if (exception instanceof AppError) {
    return build(exception.status, exception.code, exception.message, traceId, exception.errors);
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = codeForHttpStatus(status);
    const detail = status >= 500 ? GENERIC_DETAIL : httpExceptionDetail(exception);
    return build(status, code, detail, traceId);
  }

  if (isFastifyClientError(exception)) {
    return build(exception.statusCode, ErrorCode.VALIDATION_FAILED, 'Malformed request', traceId);
  }

  return build(500, ErrorCode.INTERNAL_ERROR, GENERIC_DETAIL, traceId);
}
