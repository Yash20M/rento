import { type ExecutionContext, createParamDecorator } from '@nestjs/common';

/** The caller's IP as Fastify sees it (the proxy chain is configured with `trustProxy` at deployment, P4-09). */
export const ClientIp = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    return context.switchToHttp().getRequest<{ ip: string }>().ip;
  },
);
