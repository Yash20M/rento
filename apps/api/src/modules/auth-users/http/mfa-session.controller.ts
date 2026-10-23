import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { AppError } from '../../../common/errors/app-error';
import { PROBLEM_JSON, ProblemDetailsDto } from '../../../common/errors/problem.dto';
import { RateLimited } from '../../../common/rate-limit/rate-limited.decorator';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { AuthService } from '../services/auth.service';
import { MfaService } from '../services/mfa.service';
import { AccessTokenGuard, type AuthenticatedUser } from './access-token.guard';
import { CurrentUser } from './current-user.decorator';
import { SESSION_COOKIE, assertWebRequest, cookieValue } from './web-session.controller';

export class MfaStatusDto {
  @ApiProperty({ description: 'Whether two-step verification is switched on for you.' })
  enrolled!: boolean;

  @ApiProperty({ description: 'Recovery codes you have not used yet.' })
  recoveryCodesLeft!: number;
}

export class MfaEnrolStartDto {
  @ApiPropertyOptional({
    description:
      'Your password, to prove it is you. Accounts without a password must have signed in recently instead.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  password?: string;
}

export class MfaSecretDto {
  @ApiProperty({ description: 'The secret as text (base32), to type into an authenticator app.' })
  secret!: string;

  @ApiProperty({ description: 'The `otpauth://` address; shown as a QR code the app can scan.' })
  otpauthUri!: string;
}

export class MfaCodeDto {
  @ApiProperty({ example: '123456', description: 'The 6-digit code from your authenticator app.' })
  @IsString()
  @MaxLength(12)
  code!: string;
}

export class MfaVerifyDto {
  @ApiPropertyOptional({ example: '123456', description: 'The 6-digit code from your app.' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  code?: string;

  @ApiPropertyOptional({
    example: 'ABCDE-FGHJK',
    description: 'A recovery code instead of the app code (each works once).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  recoveryCode?: string;
}

export class MfaProofDto extends MfaCodeDto {
  @ApiPropertyOptional({
    description:
      'Your password, to prove it is you. Accounts without a password must have signed in recently instead.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  password?: string;
}

export class MfaSessionDto {
  @ApiProperty({
    description:
      'A new access token for this same session, now marked as having passed the second step.',
  })
  accessToken!: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: 900, description: 'Access-token lifetime in seconds.' })
  expiresIn!: number;
}

export class MfaRecoveryCodesDto {
  @ApiProperty({
    type: [String],
    description: 'Ten single-use codes. This is the only time they are shown: save them now.',
  })
  recoveryCodes!: string[];
}

export class MfaEnrolConfirmDto extends MfaSessionDto {
  @ApiProperty({
    type: [String],
    description: 'Ten single-use codes. This is the only time they are shown: save them now.',
  })
  recoveryCodes!: string[];
}

const problem = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    content: { [PROBLEM_JSON]: { schema: { $ref: getSchemaPath(ProblemDetailsDto) } } },
  });

/**
 * Two-step verification for the admin panel's own session (P4-05). These calls carry both the access token and the
 * session cookie, because proving the second step is remembered by the session (it survives token refreshes).
 */
@ApiTags('auth')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard)
@Controller('auth/session/mfa')
export class MfaSessionController {
  constructor(
    private readonly mfa: MfaService,
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  @ApiOkResponse({ type: MfaStatusDto })
  @problem(401, '`UNAUTHENTICATED` / `TOKEN_EXPIRED` — missing, invalid or expired access token.')
  status(@CurrentUser() user: AuthenticatedUser): Promise<MfaStatusDto> {
    return this.mfa.status(user.id);
  }

  @Post('enrol')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({
    type: MfaSecretDto,
    description:
      'A new secret to add to an authenticator app. It protects nothing until confirmed.',
  })
  @problem(401, '`UNAUTHENTICATED` — wrong password; `TOKEN_EXPIRED` — sign in again first.')
  @problem(409, '`INVALID_STATE` — two-step verification is already on.')
  enrol(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaEnrolStartDto,
  ): Promise<MfaSecretDto> {
    return this.mfa.beginEnrolment(user.id, dto.password, user.authTime);
  }

  @Post('enrol/confirm')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({
    type: MfaEnrolConfirmDto,
    description:
      'Switched on. The recovery codes are shown once; the session now counts as verified.',
  })
  @problem(403, '`FORBIDDEN` — missing CSRF header or a foreign origin.')
  @problem(422, '`VALIDATION_FAILED` — the code is not right (field `code`).')
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaCodeDto,
    @Req() request: FastifyRequest,
  ): Promise<MfaEnrolConfirmDto> {
    assertWebRequest(request, this.config);
    const { recoveryCodes } = await this.mfa.confirmEnrolment(user.id, dto.code);
    return { recoveryCodes, ...(await this.upgrade(user.id, request)) };
  }

  @Post('verify')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({
    type: MfaSessionDto,
    description:
      'The second step is proved for this session (and for sensitive actions, for a limited time).',
  })
  @problem(403, '`FORBIDDEN` — missing CSRF header or a foreign origin.')
  @problem(422, '`VALIDATION_FAILED` — the code is not right, or already used (field `code`).')
  async verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaVerifyDto,
    @Req() request: FastifyRequest,
  ): Promise<MfaSessionDto> {
    assertWebRequest(request, this.config);
    await this.mfa.verify(user.id, dto);
    return this.upgrade(user.id, request);
  }

  @Post('recovery-codes')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({
    type: MfaRecoveryCodesDto,
    description: 'New codes; every old one stops working.',
  })
  @problem(401, '`UNAUTHENTICATED` — wrong password.')
  @problem(422, '`VALIDATION_FAILED` — the code is not right (field `code`).')
  async recoveryCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaProofDto,
  ): Promise<MfaRecoveryCodesDto> {
    return this.mfa.regenerateRecoveryCodes(user.id, dto.password, dto.code, user.authTime);
  }

  @Post('disable')
  @HttpCode(204)
  @RateLimited('auth')
  @ApiNoContentResponse({ description: 'Two-step verification is off for you.' })
  @problem(401, '`UNAUTHENTICATED` — wrong password.')
  @problem(409, '`INVALID_STATE` — it is required for administrators, or it is not on.')
  @problem(422, '`VALIDATION_FAILED` — the code is not right (field `code`).')
  async disable(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaProofDto): Promise<void> {
    await this.mfa.disable(user.id, dto.password, dto.code, user.authTime);
  }

  private async upgrade(
    userId: string,
    request: FastifyRequest,
  ): Promise<{ accessToken: string; tokenType: 'Bearer'; expiresIn: number }> {
    const cookie = cookieValue(request.headers.cookie, SESSION_COOKIE);
    if (!cookie) {
      throw new AppError({ status: 401, code: 'UNAUTHENTICATED', detail: 'No active session' });
    }
    const issued = await this.auth.markSessionMfaVerified(userId, cookie);
    return { accessToken: issued.token, tokenType: 'Bearer', expiresIn: issued.expiresInSeconds };
  }
}
