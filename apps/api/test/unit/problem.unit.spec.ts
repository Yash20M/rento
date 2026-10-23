import {
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/common/errors/app-error';
import { ErrorCode } from '../../src/common/errors/error-codes';
import { toProblem } from '../../src/common/errors/problem';
import { resolveRequestId } from '../../src/common/request-id';

// README §14.2 — kept literal here on purpose: this is the contract.
const README_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'BOOKING_SLOT_TAKEN',
  'EXTENSION_UNAVAILABLE',
  'REQUEST_IN_PROGRESS',
  'HOLD_EXPIRED',
  'DRAWER_CLOSED',
  'OUTSIDE_SERVICE_AREA',
  'DURATION_INVALID',
  'LEAD_TIME_VIOLATION',
  'IDEMPOTENCY_KEY_REUSED',
  'SOCIAL_TOKEN_INVALID',
  'ACCOUNT_LINK_REQUIRED',
  'LAST_LOGIN_METHOD',
  'MFA_REQUIRED',
  'STEP_UP_REQUIRED',
  'IDENTITY_IN_USE',
  'HAS_FUTURE_BOOKINGS',
  'ALREADY_EXISTS',
  'IN_USE',
  'INVALID_STATE',
  'KYC_REQUIRED',
  'AADHAAR_IN_USE',
  'PAYMENT_INVALID',
  'REAUTH_REQUIRED',
  'PERMISSION_DENIED',
  'ROLE_ESCALATION',
  'LAST_SUPER_ADMIN',
  'ROLE_IN_USE',
  'ROLE_LOCKED',
  'RATE_LIMITED',
  'RETRY_LATER',
];

describe('ErrorCode', () => {
  it('U-06 contains every README §14.2 code (plus INTERNAL_ERROR)', () => {
    const codes = Object.values(ErrorCode);
    for (const code of README_CODES) expect(codes).toContain(code);
    expect(codes).toContain('INTERNAL_ERROR');
    expect(codes).toHaveLength(README_CODES.length + 1);
  });
});

describe('toProblem', () => {
  const traceId = 'trace-1234';

  it('U-07 maps AppError as-is', () => {
    const problem = toProblem(
      new AppError({ status: 409, code: 'BOOKING_SLOT_TAKEN', detail: 'No unit free' }),
      traceId,
    );
    expect(problem).toEqual({
      type: 'urn:rento:problem:booking-slot-taken',
      title: 'Conflict',
      status: 409,
      code: 'BOOKING_SLOT_TAKEN',
      detail: 'No unit free',
      traceId,
    });
  });

  it('U-07b carries field errors', () => {
    const problem = toProblem(
      new AppError({
        status: 422,
        code: 'VALIDATION_FAILED',
        detail: 'Validation failed',
        errors: [{ field: 'a.b', message: 'bad' }],
      }),
      traceId,
    );
    expect(problem.errors).toEqual([{ field: 'a.b', message: 'bad' }]);
  });

  it.each([
    [new UnauthorizedException(), 401, 'UNAUTHENTICATED'],
    [new ForbiddenException(), 403, 'FORBIDDEN'],
    [new NotFoundException(), 404, 'NOT_FOUND'],
    [new HttpException('slow down', 429), 429, 'RATE_LIMITED'],
    [new ServiceUnavailableException(), 503, 'RETRY_LATER'],
  ])('U-08 maps %s', (exception, status, code) => {
    expect(toProblem(exception, traceId)).toMatchObject({ status, code, traceId });
  });

  it('U-09 maps other 4xx to VALIDATION_FAILED and other 5xx to INTERNAL_ERROR', () => {
    expect(toProblem(new HttpException('teapot', 418), traceId)).toMatchObject({
      status: 418,
      code: 'VALIDATION_FAILED',
    });
    const bad = toProblem(new HttpException('upstream says: secret-stuff', 502), traceId);
    expect(bad).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(bad)).not.toContain('secret-stuff');
  });

  it('U-10 maps Fastify parse errors to 400 VALIDATION_FAILED "Malformed request"', () => {
    const error = Object.assign(new Error('Unexpected end of JSON'), {
      statusCode: 400,
      code: 'FST_ERR_CTP_INVALID_JSON_BODY',
    });
    expect(toProblem(error, traceId)).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      detail: 'Malformed request',
    });
  });

  it('U-11 does not leak the message of an unexpected Error', () => {
    const problem = toProblem(new Error('select * from users where password=hunter2'), traceId);
    expect(problem).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(problem)).not.toContain('hunter2');
  });

  it.each(['boom', null, undefined, 42, {}])('U-12 handles non-Error throw %j', (thrown) => {
    expect(toProblem(thrown, traceId)).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
  });
});

describe('resolveRequestId', () => {
  const generate = () => 'generated-id-0001';

  it('U-13 keeps a valid inbound id', () => {
    expect(resolveRequestId('client.req-id_123', generate)).toBe('client.req-id_123');
  });

  it.each([
    ['too short', 'abc'],
    ['illegal characters', 'bad id with spaces!'],
    ['too long', 'a'.repeat(129)],
    ['array header', ['one-valid-id', 'two-valid-id']],
    ['missing', undefined],
  ])('U-13 replaces %s', (_label, header) => {
    expect(resolveRequestId(header, generate)).toBe('generated-id-0001');
  });
});
