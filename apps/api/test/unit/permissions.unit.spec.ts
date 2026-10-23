import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  PERMISSIONS,
  PERMISSION_KEY_PATTERN,
  diffCatalog,
  isPermissionKey,
  permissionsByGroup,
} from '../../src/modules/access-control/domain/permissions';
import {
  PermissionCatalogDriftError,
  PermissionCatalogService,
} from '../../src/modules/access-control/services/permission-catalog.service';
import type { PermissionRepository } from '../../src/modules/access-control/data/permission.repository';

const ALL_KEYS = PERMISSIONS.map((p) => p.key);

describe('the permission catalog (code)', () => {
  it('U-1 every key is lower-case resource:action and unique', () => {
    expect(new Set(ALL_KEYS).size).toBe(ALL_KEYS.length);
    for (const key of ALL_KEYS) expect(key, key).toMatch(PERMISSION_KEY_PATTERN);
  });

  it('U-2 the key pattern rejects malformed keys', () => {
    for (const bad of [
      '',
      'x',
      'a:b:c',
      'A:b',
      'a:B',
      'a:',
      ':b',
      'a b:c',
      'a:b ',
      'a-b:c',
      'a:1',
    ]) {
      expect(PERMISSION_KEY_PATTERN.test(bad), JSON.stringify(bad)).toBe(false);
    }
    expect(PERMISSION_KEY_PATTERN.test('bookings:read')).toBe(true);
    expect(PERMISSION_KEY_PATTERN.test('user_roles:read_all')).toBe(true);
  });

  it('U-3 every permission has a group and a description', () => {
    for (const permission of PERMISSIONS) {
      expect(permission.group.trim(), permission.key).not.toBe('');
      expect(permission.description.trim(), permission.key).not.toBe('');
    }
  });

  it('U-4 the catalog is exactly the README §13.5 table (docs cannot drift)', () => {
    const readme = readFileSync(path.resolve(__dirname, '../../../../README.md'), 'utf8');
    const start = readme.indexOf('#### Initial permission catalog');
    const end = readme.indexOf('Roles management and admin management', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const documented = [...readme.slice(start, end).matchAll(/`([a-z_]+:[a-z_]+)`/g)].map(
      (match) => match[1] as string,
    );
    expect([...documented].sort()).toEqual([...ALL_KEYS].sort());
  });

  it('U-5 isPermissionKey accepts catalog keys only', () => {
    expect(isPermissionKey('bookings:refund')).toBe(true);
    for (const bad of ['bookings:fly', 'Bookings:read', '', undefined, null, 42, {}]) {
      expect(isPermissionKey(bad)).toBe(false);
    }
  });

  it('U-6 permissionsByGroup keeps declaration order and loses nothing', () => {
    const groups = permissionsByGroup();
    expect(groups.map((g) => g.group)).toEqual([
      'Inventory',
      'Assets',
      'Drawers',
      'Bookings',
      'Customers',
      'Reports & audit',
      'Settings',
      'Access control',
    ]);
    expect(groups.flatMap((g) => g.permissions.map((p) => p.key))).toEqual(ALL_KEYS);
    expect(ALL_KEYS).toHaveLength(21);
  });

  it('U-7 roles and admins are separate permissions (separation of duties)', () => {
    for (const key of ['roles:read', 'roles:manage', 'admins:read', 'admins:manage']) {
      expect(isPermissionKey(key)).toBe(true);
    }
  });
});

describe('diffCatalog', () => {
  it('U-8 reports keys missing from the database and keys unknown to code', () => {
    expect(diffCatalog(ALL_KEYS)).toEqual({ missingInDatabase: [], unknownToCode: [] });

    const withoutRefund = ALL_KEYS.filter((k) => k !== 'bookings:refund');
    expect(diffCatalog([...withoutRefund, 'zzz:extra', 'aaa:extra']).missingInDatabase).toEqual([
      'bookings:refund',
    ]);
    expect(diffCatalog([...withoutRefund, 'zzz:extra', 'aaa:extra']).unknownToCode).toEqual([
      'aaa:extra',
      'zzz:extra',
    ]);
  });
});

describe('PermissionCatalogService', () => {
  const make = (listKeys: () => Promise<string[]>) => {
    const service = new PermissionCatalogService({} as never, { listKeys } as PermissionRepository);
    const warn = vi.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    return { service, warn };
  };

  it('U-9 a database that lacks a code key refuses to start, naming the key', async () => {
    const { service } = make(async () => ALL_KEYS.filter((k) => k !== 'roles:manage'));
    const failure = await service.onApplicationBootstrap().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PermissionCatalogDriftError);
    expect((failure as Error).message).toContain('roles:manage');
  });

  it('U-10 a database key unknown to code only warns (rollbacks must keep working)', async () => {
    const { service, warn } = make(async () => [...ALL_KEYS, 'future:thing']);
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('future:thing');
  });

  it('U-11 a matching catalog is silent', async () => {
    const { service, warn } = make(async () => ALL_KEYS);
    await service.onApplicationBootstrap();
    expect(warn).not.toHaveBeenCalled();
  });

  it('U-12 an unreachable database is a warning, not a crash (readyz reports it)', async () => {
    const { service, warn } = make(async () => {
      throw new Error('connect ECONNREFUSED');
    });
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).not.toContain('ECONNREFUSED');
  });
});
