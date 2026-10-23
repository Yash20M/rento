import { AppError, type FieldError } from '../../../common/errors/app-error';

/** The access token is malformed, mis-signed, or has wrong claims. Never says which. */
export class InvalidAccessTokenError extends Error {
  constructor() {
    super('Invalid access token');
    this.name = 'InvalidAccessTokenError';
  }
}

/** The access token was valid but is past its `exp`. Clients should refresh. */
export class ExpiredAccessTokenError extends Error {
  constructor() {
    super('Access token expired');
    this.name = 'ExpiredAccessTokenError';
  }
}

/** One message for every login failure, so responses reveal nothing about which accounts exist. */
export const invalidCredentials = (): AppError =>
  new AppError({ status: 401, code: 'UNAUTHENTICATED', detail: 'Invalid email or password' });

export const invalidRefreshToken = (): AppError =>
  new AppError({
    status: 401,
    code: 'UNAUTHENTICATED',
    detail: 'Invalid or expired refresh token',
  });

export const emailTaken = (): AppError =>
  new AppError({
    status: 409,
    code: 'EMAIL_TAKEN',
    detail: 'An account with this email already exists',
  });

export const weakPassword = (messages: string[], field = 'password'): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: messages.map((message): FieldError => ({ field, message })),
  });

/** Wrong, expired, already-used or superseded emailed link. One message for every cause. */
export const invalidOneTimeToken = (): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field: 'token', message: 'This link is invalid or has expired.' }],
  });

/** The provider token failed verification. Never says why (signature, audience, expiry, nonce…). */
export const socialTokenInvalid = (): AppError =>
  new AppError({
    status: 401,
    code: 'SOCIAL_TOKEN_INVALID',
    detail: 'The sign-in token could not be verified',
  });

/** The provider email matches an existing account that it is not safe to merge with automatically. */
export const accountLinkRequired = (): AppError =>
  new AppError({
    status: 409,
    code: 'ACCOUNT_LINK_REQUIRED',
    detail:
      'An account with this email already exists. Sign in with your existing method, then link this provider from your profile.',
  });

/** Suspended or deleted accounts: one generic answer, no hint about why. */
export const socialSignInDenied = (): AppError =>
  new AppError({
    status: 401,
    code: 'UNAUTHENTICATED',
    detail: 'Sign-in is not available for this account',
  });

/** No verifier is registered for this provider (it is not enabled in this deployment). */
export const socialProviderUnavailable = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'This sign-in method is not available' });

/** The session is valid, but the user signed in too long ago for a sensitive step. Refreshing does not help: sign in again. */
export const recentAuthenticationRequired = (): AppError =>
  new AppError({
    status: 401,
    code: 'REAUTH_REQUIRED',
    detail: 'Please sign in again to continue',
  });

export const identityInUse = (): AppError =>
  new AppError({
    status: 409,
    code: 'IDENTITY_IN_USE',
    detail:
      'That sign-in account is already linked to a different user, or you already have another account of this provider linked',
  });

export const lastLoginMethod = (): AppError =>
  new AppError({
    status: 409,
    code: 'LAST_LOGIN_METHOD',
    detail: 'You cannot remove your only sign-in method',
  });

export const identityNotLinked = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'That sign-in method is not linked' });

export const fieldInvalid = (field: string, message: string): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field, message }],
  });

/** Valid token, but the account is suspended/deleted or gone. */
export const accountUnavailable = (): AppError =>
  new AppError({ status: 401, code: 'UNAUTHENTICATED', detail: 'Authentication required' });
