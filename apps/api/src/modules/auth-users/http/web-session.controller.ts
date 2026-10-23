import { Body, Controller, Headers, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../../common/errors/app-error';
import { PROBLEM_JSON, ProblemDetailsDto } from '../../../common/errors/problem.dto';
import { RateLimited } from '../../../common/rate-limit/rate-limited.decorator';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { Inject } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto, UserSummaryDto } from './dto/auth.dto';

export const SESSION_COOKIE = 'rento_rt';
const SESSION_PATH = '/v1/auth/session';
/** Browsers cannot send this header cross-site without a CORS preflight, which the origin allow-list refuses. */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'rento-web';

export class WebSessionDto {
  @ApiProperty({
    description: 'Short-lived JWT. Keep it in memory; send as `Authorization: Bearer`.',
  })
  accessToken!: string;
  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType!: 'Bearer';
  @ApiProperty({ example: 900, description: 'Access-token lifetime in seconds.' })
  expiresIn!: number;
  @ApiProperty({ type: UserSummaryDto })
  user!: UserSummaryDto;
}

const problem = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    content: { [PROBLEM_JSON]: { schema: { $ref: getSchemaPath(ProblemDetailsDto) } } },
  });

export const refused = (detail: string): AppError =>
  new AppError({ status: 403, code: 'FORBIDDEN', detail });

export function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/** Cookie-authenticated calls must carry the custom header and come from this site or an allowed origin. */
export function assertWebRequest(request: FastifyRequest, config: AppConfig): void {
  if (request.headers[CSRF_HEADER] !== CSRF_VALUE) {
    throw refused('Missing the required request header');
  }
  const origin = request.headers.origin;
  if (typeof origin === 'string') {
    const sameHost = origin === `${request.protocol}://${request.headers.host}`;
    if (!sameHost && !config.corsAllowedOrigins.includes(origin)) {
      throw refused('This origin may not use the session');
    }
  }
}

/**
 * Browser sessions for the admin panel (README §13.2, ADR-012): the refresh token lives in an `HttpOnly;
 * SameSite=Strict` cookie scoped to this path, so page scripts can never read it; only the short-lived access token
 * reaches JavaScript (in memory). Cookie-authenticated calls (refresh, logout) are CSRF-protected twice over: the
 * cookie is `SameSite=Strict`, and the call must carry a custom header and — when the browser says where it came from —
 * come from an allowed origin.
 */
@ApiTags('auth')
@Controller('auth/session')
export class WebSessionController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({
    type: WebSessionDto,
    description: 'Signed in; the refresh token is set as a cookie.',
  })
  @problem(401, '`UNAUTHENTICATED` — invalid email or password (never says which).')
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<WebSessionDto> {
    this.guard(request);
    return this.issue(reply, await this.auth.login(dto.email, dto.password, request.ip));
  }

  @Post('refresh')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({ type: WebSessionDto, description: 'A new access token; the cookie is rotated.' })
  @problem(401, '`UNAUTHENTICATED` — no cookie, or an unknown, expired or spent refresh token.')
  @problem(403, '`FORBIDDEN` — missing CSRF header or a foreign origin.')
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<WebSessionDto> {
    this.guard(request);
    const token = cookieValue(request.headers.cookie, SESSION_COOKIE);
    if (!token) {
      throw new AppError({ status: 401, code: 'UNAUTHENTICATED', detail: 'No active session' });
    }
    try {
      return this.issue(reply, await this.auth.refresh(token));
    } catch (error) {
      this.clear(reply); // a dead cookie must not keep being sent
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @RateLimited('auth')
  @ApiNoContentResponse({ description: 'Session revoked and the cookie cleared. Idempotent.' })
  @problem(403, '`FORBIDDEN` — missing CSRF header or a foreign origin.')
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Headers('cookie') cookie: string | undefined,
  ): Promise<void> {
    this.guard(request);
    const token = cookieValue(cookie, SESSION_COOKIE);
    if (token) await this.auth.logout(token);
    this.clear(reply);
  }

  private guard(request: FastifyRequest): void {
    assertWebRequest(request, this.config);
  }

  private issue(
    reply: FastifyReply,
    tokens: { accessToken: string; refreshToken: string; expiresIn: number; user: UserSummaryDto },
  ): WebSessionDto {
    const maxAge = this.config.refreshTokenTtlDays * 86_400;
    const secure = this.config.nodeEnv === 'production' ? '; Secure' : '';
    void reply.header(
      'set-cookie',
      `${SESSION_COOKIE}=${encodeURIComponent(tokens.refreshToken)}; Path=${SESSION_PATH}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`,
    );
    void reply.header('cache-control', 'no-store');
    return {
      accessToken: tokens.accessToken,
      tokenType: 'Bearer',
      expiresIn: tokens.expiresIn,
      user: tokens.user,
    };
  }

  private clear(reply: FastifyReply): void {
    const secure = this.config.nodeEnv === 'production' ? '; Secure' : '';
    void reply.header(
      'set-cookie',
      `${SESSION_COOKIE}=; Path=${SESSION_PATH}; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
    );
  }
}
