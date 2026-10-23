import { SetMetadata } from '@nestjs/common';

export const SUPER_ADMIN_ONLY = 'rento:super-admin-only';

/**
 * Extra guard for endpoints that redefine access for everyone holding a role (create / edit / delete role): the caller
 * must be a Super Admin in addition to holding the permission. Handing a role to a PERSON is not guarded this way: it
 * follows the anti-escalation rules in `GrantPolicy` (README §13.5, P2-13).
 */
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_ONLY, true);
