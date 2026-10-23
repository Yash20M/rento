import { describe, expect, it } from 'vitest';
import {
  type DrawerScope,
  type EffectivePermissions,
  NO_PERMISSIONS,
  canAccessDrawer,
  drawerAccess,
  holds,
} from '../../src/modules/access-control/domain/authorization';
import { DbPermissionResolver } from '../../src/modules/access-control/services/db-permission-resolver';
import { PermissionAuthority } from '../../src/modules/access-control/services/permission-authority';
import { redact } from '../../src/modules/reporting-audit/redact';
import { FakeClock } from '../support/fake-clock';

const effective = (
  permissions: Record<string, DrawerScope>,
  extra: Partial<EffectivePermissions> = {},
): EffectivePermissions => ({
  superAdmin: false,
  hasRole: true,
  permissions: new Set(Object.keys(permissions)),
  scopes: new Map(Object.entries(permissions)),
  ...extra,
});

describe('scope helpers', () => {
  const scoped = effective({
    'bookings:read': 'all',
    'bookings:cancel': new Set(['d2', 'd1']),
  });

  it('A-1 holds: any scope counts; Super Admin holds everything, including future permissions', () => {
    expect(holds(scoped, 'bookings:cancel')).toBe(true);
    expect(holds(scoped, 'users:read')).toBe(false);
    expect(holds(effective({}, { superAdmin: true }), 'anything:new')).toBe(true);
    expect(holds(NO_PERMISSIONS, 'bookings:read')).toBe(false);
  });

  it('A-2 drawerAccess: all / sorted drawer list / none', () => {
    expect(drawerAccess(scoped, 'bookings:read')).toEqual({ kind: 'all' });
    expect(drawerAccess(scoped, 'bookings:cancel')).toEqual({ kind: 'drawers', ids: ['d1', 'd2'] });
    expect(drawerAccess(scoped, 'users:read')).toEqual({ kind: 'none' });
    expect(drawerAccess(effective({}, { superAdmin: true }), 'bookings:cancel')).toEqual({
      kind: 'all',
    });
  });

  it('A-3 canAccessDrawer: inside the scope yes, outside no, unscoped permission any drawer', () => {
    expect(canAccessDrawer(scoped, 'bookings:cancel', 'd1')).toBe(true);
    expect(canAccessDrawer(scoped, 'bookings:cancel', 'd9')).toBe(false);
    expect(canAccessDrawer(scoped, 'bookings:read', 'd9')).toBe(true);
    expect(canAccessDrawer(scoped, 'users:read', 'd1')).toBe(false);
    expect(canAccessDrawer(effective({}, { superAdmin: true }), 'bookings:cancel', 'd9')).toBe(
      true,
    );
  });
});

describe('PermissionAuthority cache', () => {
  function make(ttlSeconds: number) {
    const clock = new FakeClock('2030-01-01T00:00:00Z');
    let loads = 0;
    let answer = effective({ 'roles:read': 'all' });
    let gate: Promise<void> | undefined;
    const database = {
      effective: async () => {
        loads += 1;
        if (gate) await gate;
        return answer;
      },
    } as unknown as DbPermissionResolver;
    const authority = new PermissionAuthority(database, clock, {
      permissionCacheTtlSeconds: ttlSeconds,
    });
    return {
      authority,
      clock,
      loads: () => loads,
      setAnswer: (value: EffectivePermissions) => (answer = value),
      hold: () => {
        let release!: () => void;
        gate = new Promise<void>((resolve) => (release = resolve));
        return () => {
          gate = undefined;
          release();
        };
      },
    };
  }

  it('A-4 serves from the cache within the TTL and reloads after it (injected clock)', async () => {
    const t = make(30);
    await t.authority.effective('u1');
    await t.authority.effective('u1');
    expect(t.loads()).toBe(1);
    t.clock.advance(29_000);
    await t.authority.effective('u1');
    expect(t.loads()).toBe(1);
    t.clock.advance(2_000);
    await t.authority.effective('u1');
    expect(t.loads()).toBe(2);
  });

  it('A-5 users are cached separately', async () => {
    const t = make(30);
    await t.authority.effective('u1');
    await t.authority.effective('u2');
    expect(t.loads()).toBe(2);
  });

  it('A-6 TTL 0 disables the cache', async () => {
    const t = make(0);
    await t.authority.effective('u1');
    await t.authority.effective('u1');
    expect(t.loads()).toBe(2);
  });

  it('A-7 invalidateUser affects only that user; invalidateAll everybody', async () => {
    const t = make(30);
    await t.authority.effective('u1');
    await t.authority.effective('u2');
    t.authority.invalidateUser('u1');
    await t.authority.effective('u1');
    await t.authority.effective('u2');
    expect(t.loads()).toBe(3);
    t.authority.invalidateAll();
    await t.authority.effective('u1');
    await t.authority.effective('u2');
    expect(t.loads()).toBe(5);
  });

  it('A-8 a revoked permission is visible immediately after invalidation, not only after the TTL', async () => {
    const t = make(30);
    expect(holds(await t.authority.effective('u1'), 'roles:read')).toBe(true);
    t.setAnswer(NO_PERMISSIONS);
    expect(holds(await t.authority.effective('u1'), 'roles:read')).toBe(true); // still cached
    t.authority.invalidateUser('u1');
    expect(holds(await t.authority.effective('u1'), 'roles:read')).toBe(false);
  });

  it('A-9 a load that started BEFORE an invalidation is never stored (no stale answer outlives the change)', async () => {
    const t = make(30);
    const release = t.hold();
    const slow = t.authority.effective('u1'); // starts loading the OLD answer
    t.authority.invalidateUser('u1'); // the change happens while it is in flight
    t.setAnswer(NO_PERMISSIONS);
    release();
    await slow; // the caller of the old request may still get the old answer…
    expect(holds(await t.authority.effective('u1'), 'roles:read')).toBe(false); // …but nobody else does
    expect(t.loads()).toBe(2);
  });
});

describe('audit redaction', () => {
  it('A-10 secret-looking keys are replaced at any depth, everything else survives', () => {
    const out = redact({
      email: 'a@b.co',
      password: 'hunter2',
      nested: {
        refreshToken: 'abc',
        list: [{ apiKey: 'k', name: 'x' }],
        passwordHash: '$argon2id$…',
      },
      authorization: 'Bearer xyz',
      when: new Date('2030-01-01T00:00:00Z'),
    });
    expect(out).toEqual({
      email: 'a@b.co',
      password: '[redacted]',
      nested: {
        refreshToken: '[redacted]',
        list: [{ apiKey: '[redacted]', name: 'x' }],
        passwordHash: '[redacted]',
      },
      authorization: '[redacted]',
      when: '2030-01-01T00:00:00.000Z',
    });
  });

  it('A-11 absurdly deep structures are truncated, not followed forever', () => {
    let deep: Record<string, unknown> = { leaf: 1 };
    for (let i = 0; i < 20; i += 1) deep = { next: deep };
    expect(JSON.stringify(redact(deep))).toContain('[truncated]');
  });
});
