import { ParseUUIDPipe } from '@nestjs/common';
import { ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { PROBLEM_JSON, ProblemDetailsDto } from '../errors/problem.dto';

/** Documents an RFC 9457 error response on a route (shown in the OpenAPI document and the generated clients). */
export const problem = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    content: { [PROBLEM_JSON]: { schema: { $ref: getSchemaPath(ProblemDetailsDto) } } },
  });

/** `:id` path parameter that must be a UUID; anything else answers with the module's own "not found" error. */
export const uuidParam = (notFound: () => Error) =>
  new ParseUUIDPipe({ exceptionFactory: notFound });

export const AUTH_PROBLEMS =
  '`UNAUTHENTICATED` / `TOKEN_EXPIRED` (401) — missing, invalid or expired access token. `PERMISSION_DENIED` (403) — you lack the permission for this resource or drawer.';
