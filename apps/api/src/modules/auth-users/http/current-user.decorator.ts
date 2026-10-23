import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from './access-token.guard';

/** The authenticated caller. Only valid on routes protected by `AccessTokenGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new Error('CurrentUser used on a route without AccessTokenGuard');
    return request.user;
  },
);
