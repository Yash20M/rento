import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_POLICY } from '../../src/common/rate-limit/rate-limited.decorator';
import { AuthController } from '../../src/modules/auth-users/http/auth.controller';

describe('rate-limit hook (implemented by P2-31)', () => {
  it.each(['register', 'login', 'refresh', 'logout'] as const)(
    'U-15 POST /auth/%s carries the "auth" rate-limit policy',
    (method) => {
      const handler = AuthController.prototype[method];
      expect(Reflect.getMetadata(RATE_LIMIT_POLICY, handler)).toBe('auth');
    },
  );
});
