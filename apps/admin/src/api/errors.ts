import type { components } from '@rento/contracts';

type Problem = components['schemas']['ProblemDetailsDto'];

/** A failed API call, with the stable `code` and the per-field messages of the RFC 9457 problem. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const isProblem = (value: unknown): value is Problem =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { code?: unknown }).code === 'string';

/** Turns an `openapi-fetch` result into its data, or throws an {@link ApiError}. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error === undefined && result.response.ok) return result.data as T;
  const problem = isProblem(result.error) ? result.error : undefined;
  const fields: Record<string, string> = {};
  for (const entry of problem?.errors ?? []) {
    if (!(entry.field in fields)) fields[entry.field] = entry.message;
  }
  throw new ApiError(
    result.response.status,
    problem?.code ?? 'UNKNOWN',
    problem?.detail ?? `The request failed (${result.response.status})`,
    fields,
  );
}

/** Short, human text for any thrown value. */
export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'PERMISSION_DENIED':
      case 'FORBIDDEN':
        return 'You do not have permission to do that.';
      case 'RETRY_LATER':
        return 'The system is busy. Please try again in a moment.';
      default:
        return error.message;
    }
  }
  if (error instanceof TypeError) return 'Cannot reach the server. Check your connection.';
  return 'Something went wrong. Please try again.';
}

/** Field messages of a validation error (empty for anything else). */
export const fieldErrors = (error: unknown): Readonly<Record<string, string>> =>
  error instanceof ApiError ? error.fields : {};
