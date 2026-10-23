import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AllowWithoutMfa } from '../../src/modules/access-control/http/allow-without-mfa.decorator';
import { PermissionGuard } from '../../src/modules/access-control/http/permission.guard';
import {
  REQUIRED_PERMISSION,
  RequirePermission,
} from '../../src/modules/access-control/http/require-permission.decorator';
import { SuperAdminOnly } from '../../src/modules/access-control/http/super-admin-only.decorator';
import { testConfig } from '../support/create-test-app';
import { FakeClock } from '../support/fake-clock';
import { FakePermissionResolver } from '../support/fake-permission-resolver';

class Annotated {
  @RequirePermission('roles:read')
  read(): void {}

  @RequirePermission('roles:manage')
  manage(): void {}

  undeclared(): void {}

  @RequirePermission('roles:manage')
  @SuperAdminOnly()
  grant(): void {}

  @RequirePermission('roles:read')
  @AllowWithoutMfa()
  telling(): void {}
}

function context(
  handler: () => void,
  user?: { id: string; mfaAt?: number | undefined },
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Annotated,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}
const instance = new Annotated();
const denial = { status: 403, code: 'PERMISSION_DENIED' };

describe('PermissionGuard', () => {
  const fake = new FakePermissionResolver();
  fake.grant('reader', 'roles:read');
  fake.makeSuperAdmin('boss');
  const NOW = '2030-01-07T03:00:00Z';
  const nowSeconds = new Date(NOW).getTime() / 1000;
  const clock = new FakeClock(NOW);
  const guard = new PermissionGuard(new Reflector(), fake, testConfig(), clock);
  const strict = new PermissionGuard(
    new Reflector(),
    fake,
    testConfig({ ADMIN_MFA_REQUIRED: 'true', STEP_UP_MAX_AGE_SECONDS: '600' }),
    clock,
  );

  it('G-1 the decorator stores the permission on the handler', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSION, instance.read)).toBe('roles:read');
  });

  it('G-2 allows the holder, denies a user without it, allows the Super Admin', async () => {
    await expect(guard.canActivate(context(instance.read, { id: 'reader' }))).resolves.toBe(true);
    await expect(
      guard.canActivate(context(instance.manage, { id: 'reader' })),
    ).rejects.toMatchObject(denial);
    await expect(guard.canActivate(context(instance.manage, { id: 'boss' }))).resolves.toBe(true);
    await expect(
      guard.canActivate(context(instance.read, { id: 'stranger' })),
    ).rejects.toMatchObject(denial);
  });

  it('G-3 DENY BY DEFAULT: a route with no declared permission is refused, even for the Super Admin', async () => {
    await expect(
      guard.canActivate(context(instance.undeclared, { id: 'boss' })),
    ).rejects.toMatchObject(denial);
  });

  it('G-4 a request that was not authenticated is refused', async () => {
    await expect(guard.canActivate(context(instance.read))).rejects.toMatchObject(denial);
  });

  it('G-5 INTERIM: a super-admin-only route needs a Super Admin even when the permission is held', async () => {
    fake.grant('manager', 'roles:manage');
    await expect(
      guard.canActivate(context(instance.grant, { id: 'manager' })),
    ).rejects.toMatchObject({
      status: 403,
      code: 'ROLE_ESCALATION',
    });
    await expect(guard.canActivate(context(instance.grant, { id: 'boss' }))).resolves.toBe(true);
    // without the permission it is the ordinary denial
    await expect(
      guard.canActivate(context(instance.grant, { id: 'stranger' })),
    ).rejects.toMatchObject(denial);
  });

  describe('while two-step verification is required (P4-05)', () => {
    it('G-6 a session that never passed the second step is refused everywhere except the call that tells it what to do', async () => {
      await expect(
        strict.canActivate(context(instance.read, { id: 'reader' })),
      ).rejects.toMatchObject({ status: 403, code: 'MFA_REQUIRED' });
      await expect(strict.canActivate(context(instance.telling, { id: 'reader' }))).resolves.toBe(
        true,
      );
    });

    it('G-7 someone who may not do it still hears "no", not "verify first"', async () => {
      await expect(
        strict.canActivate(context(instance.read, { id: 'stranger' })),
      ).rejects.toMatchObject(denial);
    });

    it('G-8 a verified session passes ordinary routes however old the proof is', async () => {
      const old = nowSeconds - 86_400;
      await expect(
        strict.canActivate(context(instance.read, { id: 'reader', mfaAt: old })),
      ).resolves.toBe(true);
    });

    it('G-9 the sensitive actions need a recent proof: fresh passes, stale asks for a new code', async () => {
      fake.grant('manager', 'roles:manage');
      await expect(
        strict.canActivate(context(instance.manage, { id: 'manager', mfaAt: nowSeconds - 60 })),
      ).resolves.toBe(true);
      await expect(
        strict.canActivate(context(instance.manage, { id: 'manager', mfaAt: nowSeconds - 601 })),
      ).rejects.toMatchObject({ status: 403, code: 'STEP_UP_REQUIRED' });
    });

    it('G-10 when not required (the default) nothing changes', async () => {
      await expect(guard.canActivate(context(instance.read, { id: 'reader' }))).resolves.toBe(true);
    });
  });
});
