import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { AppError } from '../../../../common/errors/app-error';
import type { SocialCredentials } from '../../domain/social';
import { AuthResponseDto } from './auth.dto';

// Provider tokens are JWTs or opaque strings of a few KB at most; the bound only stops absurd payloads.
const MAX_TOKEN = 8192;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google ID token obtained on the device (verified server-side).' })
  @IsString()
  @Length(1, MAX_TOKEN)
  idToken!: string;
}

export class FacebookLoginDto {
  @ApiPropertyOptional({
    description: 'Classic Login access token. Send this OR the Limited Login pair.',
  })
  @IsOptional()
  @IsString()
  @Length(1, MAX_TOKEN)
  accessToken?: string;

  @ApiPropertyOptional({ description: 'iOS Limited Login OIDC token; requires `nonce`.' })
  @IsOptional()
  @IsString()
  @Length(1, MAX_TOKEN)
  authenticationToken?: string;

  @ApiPropertyOptional({ description: 'Nonce used when requesting the Limited Login token.' })
  @IsOptional()
  @IsString()
  @Length(1, 256)
  nonce?: string;
}

export class AppleLoginDto {
  @ApiProperty({ description: 'Apple identity token (JWT) from Sign in with Apple.' })
  @IsString()
  @Length(1, MAX_TOKEN)
  identityToken!: string;

  @ApiProperty({ description: 'The raw nonce whose hash was sent to Apple.' })
  @IsString()
  @Length(1, 256)
  nonce!: string;

  @ApiPropertyOptional({
    description:
      'Display name. Apple only provides it on the first sign-in, so the app forwards it.',
    maxLength: 200,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  fullName?: string;
}

export class SocialAuthResponseDto extends AuthResponseDto {
  @ApiProperty({
    enum: ['email', 'phone'],
    isArray: true,
    description:
      'Profile fields the app should still collect. `email` when the account has none (the provider withheld it or did not verify it).',
  })
  needsProfileCompletion!: Array<'email' | 'phone'>;
}

const invalidFacebookBody = (message: string): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field: 'accessToken', message }],
  });

/** Facebook has two mutually exclusive modes; the DTO validates fields, this validates the combination. */
export function facebookCredentials(dto: FacebookLoginDto): SocialCredentials {
  const { accessToken, authenticationToken, nonce } = dto;
  if (accessToken !== undefined) {
    if (authenticationToken !== undefined || nonce !== undefined) {
      throw invalidFacebookBody(
        'send either accessToken or authenticationToken with nonce, not both',
      );
    }
    return { provider: 'facebook', accessToken };
  }
  if (authenticationToken !== undefined && nonce !== undefined) {
    return { provider: 'facebook', authenticationToken, nonce };
  }
  throw invalidFacebookBody('send accessToken, or authenticationToken together with nonce');
}
