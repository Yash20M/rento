import { AppError } from '../../../common/errors/app-error';

const notFound = (what: string): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: `${what} not found` });

export const categoryNotFound = (): AppError => notFound('Category');
export const itemModelNotFound = (): AppError => notFound('Item model');
export const assetNotFound = (): AppError => notFound('Asset');

export const alreadyExists = (field: string, message: string): AppError =>
  new AppError({
    status: 409,
    code: 'ALREADY_EXISTS',
    detail: message,
    errors: [{ field, message }],
  });

export const inUse = (detail: string): AppError =>
  new AppError({ status: 409, code: 'IN_USE', detail });

export const hasFutureBookings = (detail: string): AppError =>
  new AppError({ status: 409, code: 'HAS_FUTURE_BOOKINGS', detail });

export const invalidField = (field: string, message: string): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field, message }],
  });

export const invalidTransition = (from: string, to: string): AppError =>
  new AppError({
    status: 409,
    code: 'IN_USE',
    detail: `An asset cannot go from "${from}" to "${to}"`,
    errors: [{ field: 'status', message: `cannot change from ${from} to ${to}` }],
  });
