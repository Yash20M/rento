import { AppError } from '../../../common/errors/app-error';

export const roleNotFound = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'Role not found' });

/** The Super Admin (and any other system role) is locked. */
export const roleLocked = (): AppError =>
  new AppError({
    status: 409,
    code: 'ROLE_LOCKED',
    detail: 'This is a system role and cannot be changed or deleted',
  });

export const roleInUse = (): AppError =>
  new AppError({
    status: 409,
    code: 'ROLE_IN_USE',
    detail: 'This role is still assigned to people; remove the assignments first',
  });

export const roleNameTaken = (): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field: 'name', message: 'a role with this name already exists' }],
  });

export const unknownPermissions = (keys: readonly string[]): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field: 'permissions', message: `unknown permission: ${keys.join(', ')}` }],
  });
