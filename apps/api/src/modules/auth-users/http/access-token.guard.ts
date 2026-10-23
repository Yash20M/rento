import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AppError } from '../../../common/errors/app-error';
import { ExpiredAccessTokenError, InvalidAccessTokenError } from '../domain/auth-errors';
import { AccessTokenService } from '../services/access-token.service';

export interface AuthenticatedUser {
  id: string;
  tokenId: string;
  /** When the access token was issued, in epoch seconds (drives the fresh-auth rule). */
  issuedAt: number;
  /** When the user last actually signed in (epoch seconds); a refresh does not move it. */
  authTime: number;
  /** When the session last proved the second step (epoch seconds), if ever. */
  mfaAt: number | undefined;
}

export type AuthenticatedRequest = FastifyRequest & { user?: AuthenticatedUser };

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Authenticates a request from `Authorization: Bearer <access token>`. Opt-in per route
 * (`@UseGuards(AccessTokenGuard)`); the deny-by-default admin guard is P2-12. Verifies the token only —
 * it does not load the user (permission and account-status checks come with P2-12 / P2-32).
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly tokens: AccessTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const match = typeof header === 'string' ? BEARER.exec(header) : null;
    if (!match?.[1]) throw this.unauthenticated();

    try {
      const verified = await this.tokens.verify(match[1]);
      request.user = {
        id: verified.userId,
        tokenId: verified.tokenId,
        issuedAt: verified.issuedAt,
        authTime: verified.authTime,
        mfaAt: verified.mfaAt,
      };
      return true;
    } catch (error) {
      if (error instanceof ExpiredAccessTokenError) {
        throw new AppError({ status: 401, code: 'TOKEN_EXPIRED', detail: 'Access token expired' });
      }
      if (error instanceof InvalidAccessTokenError) throw this.unauthenticated();
      throw error;
    }
  }

  private unauthenticated(): AppError {
    return new AppError({
      status: 401,
      code: 'UNAUTHENTICATED',
      detail: 'Authentication required',
    });
  }
}
