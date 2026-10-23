import { AppError } from '../../../common/errors/app-error';

export const adminNotFound = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'No such active user' });

export const invitationNotFound = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'No such open invitation' });

export const invalidAssignments = (message: string): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field: 'roles', message }],
  });

/** The Google account used to accept an invitation is not the invited address (or Google did not verify it). */
export const invitationEmailMismatch = (): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [
      {
        field: 'idToken',
        message: 'sign in with the Google account whose verified email is the invited address',
      },
    ],
  });
