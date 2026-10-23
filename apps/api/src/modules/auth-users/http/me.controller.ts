import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { IMAGE_TYPES } from '../../../common/media/images';
import { PROBLEM_JSON, ProblemDetailsDto } from '../../../common/errors/problem.dto';
import { RateLimited } from '../../../common/rate-limit/rate-limited.decorator';
import { identityNotLinked } from '../domain/auth-errors';
import { IdentityService, type IdentityView } from '../services/identity.service';
import { AccountLifecycleService } from '../services/account-lifecycle.service';
import { AvatarService } from '../services/avatar.service';
import { PasswordChangeService } from '../services/password-change.service';
import { ProfileService } from '../services/profile.service';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AccessTokenGuard, type AuthenticatedUser } from './access-token.guard';
import { CurrentUser } from './current-user.decorator';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  IdentityDto,
  ProfileDto,
  UpdateProfileDto,
} from './dto/me.dto';
import {
  AppleLoginDto,
  FacebookLoginDto,
  GoogleLoginDto,
  facebookCredentials,
} from './dto/social.dto';

const problem = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    content: { [PROBLEM_JSON]: { schema: { $ref: getSchemaPath(ProblemDetailsDto) } } },
  });

const PROVIDERS = ['password', 'google', 'facebook', 'apple'];

const view = (identity: IdentityView): IdentityDto => ({
  ...identity,
  linkedAt: identity.linkedAt.toISOString(),
});

const LINK_PROBLEMS = {
  fresh:
    '`TOKEN_EXPIRED` — the access token is too old for linking: refresh the session and retry.',
  invalid: '`SOCIAL_TOKEN_INVALID` — the provider token failed verification.',
  inUse:
    '`IDENTITY_IN_USE` — that provider account is linked to a different user, or you already have one of this provider.',
};

@ApiTags('me')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly identities: IdentityService,
    private readonly profile: ProfileService,
    private readonly account: AccountLifecycleService,
    private readonly avatars: AvatarService,
    private readonly passwords: PasswordChangeService,
  ) {}

  @Get('identities')
  @ApiOkResponse({ type: IdentityDto, isArray: true, description: 'Your sign-in methods.' })
  @problem(401, '`UNAUTHENTICATED` / `TOKEN_EXPIRED` — missing, invalid or expired access token.')
  async list(@CurrentUser() user: AuthenticatedUser): Promise<IdentityDto[]> {
    return (await this.identities.list(user.id)).map(view);
  }

  @Post('identities/google')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({
    type: IdentityDto,
    isArray: true,
    description: 'Your sign-in methods after linking.',
  })
  @problem(401, `${LINK_PROBLEMS.fresh} ${LINK_PROBLEMS.invalid}`)
  @problem(404, '`NOT_FOUND` — this sign-in method is not enabled.')
  @problem(409, LINK_PROBLEMS.inUse)
  async linkGoogle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GoogleLoginDto,
  ): Promise<IdentityDto[]> {
    const linked = await this.identities.link(user.id, user.authTime, {
      provider: 'google',
      idToken: dto.idToken,
    });
    return linked.map(view);
  }

  @Post('identities/facebook')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({
    type: IdentityDto,
    isArray: true,
    description: 'Your sign-in methods after linking.',
  })
  @problem(401, `${LINK_PROBLEMS.fresh} ${LINK_PROBLEMS.invalid}`)
  @problem(404, '`NOT_FOUND` — this sign-in method is not enabled.')
  @problem(409, LINK_PROBLEMS.inUse)
  async linkFacebook(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FacebookLoginDto,
  ): Promise<IdentityDto[]> {
    const linked = await this.identities.link(user.id, user.authTime, facebookCredentials(dto));
    return linked.map(view);
  }

  @Post('identities/apple')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({
    type: IdentityDto,
    isArray: true,
    description: 'Your sign-in methods after linking.',
  })
  @problem(401, `${LINK_PROBLEMS.fresh} ${LINK_PROBLEMS.invalid}`)
  @problem(404, '`NOT_FOUND` — this sign-in method is not enabled.')
  @problem(409, LINK_PROBLEMS.inUse)
  async linkApple(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AppleLoginDto,
  ): Promise<IdentityDto[]> {
    const linked = await this.identities.link(user.id, user.authTime, {
      provider: 'apple',
      identityToken: dto.identityToken,
      nonce: dto.nonce,
    });
    return linked.map(view);
  }

  @Delete('identities/:provider')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Sign-in method removed.' })
  @problem(404, '`NOT_FOUND` — that method is not linked to your account.')
  @problem(409, '`LAST_LOGIN_METHOD` — it is your only sign-in method.')
  async unlink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
  ): Promise<void> {
    if (!PROVIDERS.includes(provider)) throw identityNotLinked();
    await this.identities.unlink(user.id, provider);
  }

  @Get()
  @ApiOkResponse({ type: ProfileDto })
  @problem(401, '`UNAUTHENTICATED` / `TOKEN_EXPIRED` — missing, invalid or expired access token.')
  me(@CurrentUser() user: AuthenticatedUser): Promise<ProfileDto> {
    return this.account.get(user.id);
  }

  @Post('avatar')
  @HttpCode(200)
  @ApiConsumes(...IMAGE_TYPES)
  @ApiBody({
    description: 'The image itself (JPEG, PNG or WebP, at most 2 MB), sent as the request body.',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiOkResponse({ type: ProfileDto, description: 'Your profile with the new photo.' })
  @problem(401, '`UNAUTHENTICATED` / `TOKEN_EXPIRED` — missing, invalid or expired access token.')
  @problem(422, '`VALIDATION_FAILED` — not a JPEG/PNG/WebP image, empty, or larger than 2 MB.')
  async setAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
    @Headers('content-type') contentType: string | undefined,
  ): Promise<ProfileDto> {
    const claimed = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
    await this.avatars.set(user.id, request.body, claimed);
    return this.account.get(user.id);
  }

  @Delete('avatar')
  @HttpCode(200)
  @ApiOkResponse({
    type: ProfileDto,
    description: 'Your profile without a photo (also when you had none).',
  })
  @problem(401, '`UNAUTHENTICATED` / `TOKEN_EXPIRED` — missing, invalid or expired access token.')
  async clearAvatar(@CurrentUser() user: AuthenticatedUser): Promise<ProfileDto> {
    await this.avatars.clear(user.id);
    return this.account.get(user.id);
  }

  @Post('password')
  @HttpCode(204)
  @RateLimited('auth')
  @ApiNoContentResponse({
    description:
      'Password changed. Every session is signed out: sign in again with the new password.',
  })
  @problem(
    401,
    '`UNAUTHENTICATED` — the current password is wrong, or the access token is missing/expired.',
  )
  @problem(409, '`INVALID_STATE` — the account has no password yet (use "Forgot password").')
  @problem(
    422,
    '`VALIDATION_FAILED` — the new password breaks the rules or equals the current one.',
  )
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.passwords.change(user.id, dto.currentPassword, dto.newPassword);
  }

  @Delete()
  @HttpCode(204)
  @RateLimited('auth')
  @ApiNoContentResponse({
    description:
      'Account deleted: everything that identifies you is removed, every session is signed out. Bookings and payments stay, without your details.',
  })
  @problem(
    401,
    '`UNAUTHENTICATED` — wrong password; `TOKEN_EXPIRED` — sign in again first (accounts without a password).',
  )
  @problem(
    409,
    '`HAS_FUTURE_BOOKINGS` — a booking is still live; `INVALID_STATE` — a staff account.',
  )
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    await this.account.deleteAccount(user.id, ip, user.authTime, dto.password);
  }

  @Patch()
  @ApiOkResponse({ type: ProfileDto })
  @problem(401, '`UNAUTHENTICATED` / `TOKEN_EXPIRED` — missing, invalid or expired access token.')
  @problem(409, '`EMAIL_TAKEN` — another account already uses that email.')
  @problem(422, '`VALIDATION_FAILED` — invalid or unknown field, empty body, or an email change.')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileDto> {
    return this.profile.update(user.id, dto);
  }
}
