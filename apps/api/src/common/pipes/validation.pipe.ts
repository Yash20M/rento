import { ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { AppError, type FieldError } from '../errors/app-error';

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent === '' ? error.property : `${parent}.${error.property}`;
    const own = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/** Strict DTO validation: unknown fields rejected, every violation reported at once (README §14.1). */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: false,
    exceptionFactory: (errors) =>
      new AppError({
        status: 422,
        code: 'VALIDATION_FAILED',
        detail: 'Request validation failed',
        errors: flatten(errors),
      }),
  });
}
