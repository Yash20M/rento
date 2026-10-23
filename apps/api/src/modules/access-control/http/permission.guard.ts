import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { PERMISSION_RESOLVER, type PermissionResolver, holds } from '../domain/authorization';
import { ALLOW_WITHOUT_MFA } from './allow-without-mfa.decorator';
import { ADMIN_ACCESS, REQUIRED_PERMISSION } from './require-permission.decorator';
import { SUPER_ADMIN_ONLY } from './super-admin-only.decorator';

interface RequestWithUser {
  user?: { id: string; mfaAt?: number | undefined };
}

/** Actions where a stolen session does the most damage: they need the second step proved recently (README §15). */
export const STEP_UP_PERMISSIONS: ReadonlySet<string> = new Set([
  'roles:manage',
  'admins:manage',
  'bookings:refund',
]);

const denied = (): AppError =>
  new AppError({
    status: 403,
    code: 'PERMISSION_DENIED',
    detail: 'You do not have permission to do this',
  });

/**
 * Authorizes a request that `AccessTokenGuard` has already authenticated (list it AFTER that guard). A route with no
 * declared permission is denied, so forgetting `@RequirePermission` can never open a route.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PERMISSION_RESOLVER) private readonly resolver: PermissionResolver,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const required = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRED_PERMISSION,
      targets,
    );
    const adminAccess = this.reflector.getAllAndOverride<boolean | undefined>(
      ADMIN_ACCESS,
      targets,
    );
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if ((required === undefined && !adminAccess) || !user) throw denied();

    const effective = await this.resolver.effective(user.id);
    if (required !== undefined) {
      if (!holds(effective, required)) throw denied();
    } else if (!effective.superAdmin && !effective.hasRole) {
      throw denied();
    }

    this.requireSecondStep(context, user, required);

    const superAdminOnly = this.reflector.getAllAndOverride<boolean | undefined>(
      SUPER_ADMIN_ONLY,
      targets,
    );
    if (superAdminOnly && !effective.superAdmin) {
      throw new AppError({
        status: 403,
        code: 'ROLE_ESCALATION',
        detail: 'Only a Super Admin can grant or change access',
      });
    }
    return true;
  }

  /**
   * While two-step verification is required: a session that never proved it is limited to what tells the person to do so,
   * and the sensitive actions need the proof to be recent. Runs after the permission check, so someone without the
   * permission still hears "no", not "verify first".
   */
  private requireSecondStep(
    context: ExecutionContext,
    user: { mfaAt?: number | undefined },
    required: string | undefined,
  ): void {
    if (!this.config.adminMfaRequired) return;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_WITHOUT_MFA, targets)) return;
    if (user.mfaAt === undefined) {
      throw new AppError({
        status: 403,
        code: 'MFA_REQUIRED',
        detail: 'Two-step verification is required. Enter the code from your authenticator app',
      });
    }
    const age = this.clock.now().getTime() / 1000 - user.mfaAt;
    if (
      required !== undefined &&
      STEP_UP_PERMISSIONS.has(required) &&
      age > this.config.stepUpMaxAgeSeconds
    ) {
      throw new AppError({
        status: 403,
        code: 'STEP_UP_REQUIRED',
        detail: 'Confirm it is you: enter a fresh code from your authenticator app',
      });
    }
  }
}
