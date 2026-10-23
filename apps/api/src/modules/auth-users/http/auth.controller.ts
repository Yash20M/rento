import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { PROBLEM_JSON, ProblemDetailsDto } from '../../../common/errors/problem.dto';
import { RateLimited } from '../../../common/rate-limit/rate-limited.decorator';
import { AuthService } from '../services/auth.service';
import { AuthMailService } from '../services/auth-mail.service';
import { EmailVerificationService } from '../services/email-verification.service';
import { SocialAuthService } from '../services/social-auth.service';
import { PasswordResetService } from '../services/password-reset.service';
import { AccessTokenGuard, type AuthenticatedUser } from './access-token.guard';
import { CurrentUser } from './current-user.decorator';
import { ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto/recovery.dto';
import {
  AppleLoginDto,
  FacebookLoginDto,
  GoogleLoginDto,
  SocialAuthResponseDto,
  facebookCredentials,
} from './dto/social.dto';
import { AuthResponseDto, LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';

const problem = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    content: { [PROBLEM_JSON]: { schema: { $ref: getSchemaPath(ProblemDetailsDto) } } },
  });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
    private readonly emailVerification: EmailVerificationService,
    private readonly mail: AuthMailService,
    private readonly social: SocialAuthService,
  ) {}

  @Post('register')
  @RateLimited('auth')
  @ApiCreatedResponse({ type: AuthResponseDto, description: 'Account created and signed in.' })
  @problem(409, '`EMAIL_TAKEN` — an account with this email already exists.')
  @problem(422, '`VALIDATION_FAILED` — invalid field or weak password (see `errors[]`).')
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({ type: AuthResponseDto })
  @problem(401, '`UNAUTHENTICATED` — invalid email or password (never says which).')
  @problem(422, '`VALIDATION_FAILED` — missing or malformed fields.')
  @problem(
    429,
    '`RATE_LIMITED` — too many requests or too many failed sign-ins; see `Retry-After`.',
  )
  login(@Body() dto: LoginDto, @ClientIp() ip: string): Promise<AuthResponseDto> {
    return this.auth.login(dto.email, dto.password, ip);
  }

  @Post('refresh')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({
    type: AuthResponseDto,
    description: 'A new access + refresh token pair (the old refresh token is now spent).',
  })
  @problem(
    401,
    '`UNAUTHENTICATED` — unknown, expired, revoked or already-used refresh token. Reuse of a spent token revokes the whole session.',
  )
  @problem(422, '`VALIDATION_FAILED` — missing or malformed `refreshToken`.')
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @RateLimited('auth')
  @ApiNoContentResponse({
    description: 'Session revoked. Idempotent: unknown tokens also return 204.',
  })
  @problem(422, '`VALIDATION_FAILED` — missing or malformed `refreshToken`.')
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Post('password/forgot')
  @HttpCode(202)
  @RateLimited('auth')
  @ApiAcceptedResponse({
    description:
      'Always 202, whether or not the address has an account. If it does, a single-use reset link is emailed (at most one per minute).',
  })
  @problem(422, '`VALIDATION_FAILED` — missing or malformed email.')
  forgotPassword(@Body() dto: ForgotPasswordDto): void {
    // Everything (lookup, token, mail) runs in the background so the response is identical and equally fast for
    // every address — no account enumeration, not even by timing.
    this.mail.background('password_reset', () => this.passwordReset.processRequest(dto.email));
  }

  @Post('password/reset')
  @HttpCode(204)
  @RateLimited('auth')
  @ApiNoContentResponse({
    description:
      'Password changed; every session of the account is signed out. Sign in again with the new password.',
  })
  @problem(
    422,
    '`VALIDATION_FAILED` — field `token` (invalid, expired, used or superseded link) or `newPassword` (weak; the link stays usable).',
  )
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.passwordReset.reset(dto.token, dto.newPassword);
  }

  @Post('email/verify')
  @HttpCode(204)
  @RateLimited('auth')
  @ApiNoContentResponse({ description: 'Email address verified.' })
  @problem(422, '`VALIDATION_FAILED` — field `token`: invalid, expired, used or superseded link.')
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.emailVerification.verify(dto.token);
  }

  @Post('email/verification/resend')
  @HttpCode(202)
  @RateLimited('auth')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('bearer')
  @ApiAcceptedResponse({
    description:
      'Accepted. A new verification link is emailed unless the address is already verified or one was sent in the last minute.',
  })
  @problem(401, '`UNAUTHENTICATED` / `TOKEN_EXPIRED` — missing, invalid or expired access token.')
  resendVerification(@CurrentUser() user: AuthenticatedUser): void {
    this.mail.background('email_verification', () => this.emailVerification.issueAndSend(user.id));
  }

  @Post('social/google')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({ type: SocialAuthResponseDto })
  @problem(
    401,
    '`SOCIAL_TOKEN_INVALID` — the Google token failed verification; `UNAUTHENTICATED` — the account cannot sign in.',
  )
  @problem(404, '`NOT_FOUND` — this sign-in method is not enabled.')
  @problem(
    409,
    '`ACCOUNT_LINK_REQUIRED` — the email belongs to an existing account that cannot be linked automatically.',
  )
  @problem(422, '`VALIDATION_FAILED` — missing or malformed `idToken`.')
  signInWithGoogle(@Body() dto: GoogleLoginDto): Promise<SocialAuthResponseDto> {
    return this.social.signIn({ provider: 'google', idToken: dto.idToken });
  }

  @Post('social/facebook')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({ type: SocialAuthResponseDto })
  @problem(
    401,
    '`SOCIAL_TOKEN_INVALID` — the Meta token failed verification; `UNAUTHENTICATED` — the account cannot sign in.',
  )
  @problem(404, '`NOT_FOUND` — this sign-in method is not enabled.')
  @problem(
    409,
    '`ACCOUNT_LINK_REQUIRED` — the email belongs to an existing account that cannot be linked automatically.',
  )
  @problem(
    422,
    '`VALIDATION_FAILED` — send `accessToken`, or `authenticationToken` together with `nonce`.',
  )
  signInWithFacebook(@Body() dto: FacebookLoginDto): Promise<SocialAuthResponseDto> {
    return this.social.signIn(facebookCredentials(dto));
  }

  @Post('social/apple')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({ type: SocialAuthResponseDto })
  @problem(
    401,
    '`SOCIAL_TOKEN_INVALID` — the Apple token failed verification; `UNAUTHENTICATED` — the account cannot sign in.',
  )
  @problem(404, '`NOT_FOUND` — this sign-in method is not enabled.')
  @problem(
    409,
    '`ACCOUNT_LINK_REQUIRED` — the email belongs to an existing account that cannot be linked automatically.',
  )
  @problem(422, '`VALIDATION_FAILED` — missing or malformed `identityToken` / `nonce`.')
  signInWithApple(@Body() dto: AppleLoginDto): Promise<SocialAuthResponseDto> {
    return this.social.signIn({
      provider: 'apple',
      identityToken: dto.identityToken,
      nonce: dto.nonce,
      fullName: dto.fullName,
    });
  }
}
