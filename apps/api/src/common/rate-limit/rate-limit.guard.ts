import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { AccessTokenService } from '../../modules/auth-users/services/access-token.service';
import { RATE_LIMIT_POLICY, type RateLimitPolicy } from './rate-limited.decorator';
import { RateLimitService } from './rate-limit.service';

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Enforces `@RateLimited(policy)` on every route that carries it: sign-in and recovery per address and per account,
 * bookings per signed-in customer (README §15). Runs before the route's own guards, so floods are refused cheaply.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limits: RateLimitService,
    private readonly tokens: AccessTokenService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.limits.enabled) return true;
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy | undefined>(
      RATE_LIMIT_POLICY,
      [context.getHandler(), context.getClass()],
    );
    if (!policy) return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (policy === 'auth') {
      this.limits.consume('auth-ip', request.ip, this.config.authRatePerIp);
      const email = (request.body as { email?: unknown } | undefined)?.email;
      if (typeof email === 'string' && email !== '') {
        this.limits.consume(
          'auth-account',
          email.trim().toLowerCase(),
          this.config.authRatePerAccount,
        );
      }
      return true;
    }

    // booking: per signed-in customer; an unusable token falls back to the address (the route refuses it anyway).
    const header = request.headers.authorization;
    const match = typeof header === 'string' ? BEARER.exec(header) : null;
    let who = `ip:${request.ip}`;
    if (match?.[1]) {
      try {
        who = `user:${(await this.tokens.verify(match[1])).userId}`;
      } catch {
        // invalid or expired: the route's own guard answers 401
      }
    }
    this.limits.consume('booking', who, this.config.bookingRatePerUser);
    return true;
  }
}
