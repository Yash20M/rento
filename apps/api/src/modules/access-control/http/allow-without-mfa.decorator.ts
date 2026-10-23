import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_MFA = 'rento:allow-without-mfa';

/**
 * Lets an admin route answer a session that has not passed the second step yet — only for the few calls the admin panel
 * needs to tell the person what to do next (`GET /v1/admin/me`). Every other admin route is closed to such a session
 * while two-step verification is required.
 */
export const AllowWithoutMfa = () => SetMetadata(ALLOW_WITHOUT_MFA, true);
