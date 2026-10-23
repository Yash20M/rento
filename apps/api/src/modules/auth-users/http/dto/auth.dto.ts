import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'asha@example.com', maxLength: 254 })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    minLength: 10,
    maxLength: 128,
    description: 'At least 10 characters; not a common password; not your email.',
  })
  @IsString()
  @MaxLength(1000) // hard bound before any hashing; the policy enforces the real 128 limit
  password!: string;

  @ApiProperty({ example: 'Asha Rao', minLength: 1, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ example: '+919876543210', description: 'E.164 format.' })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format, e.g. +919876543210' })
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'asha@example.com' })
  @Transform(normalizeEmail)
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'The opaque refresh token issued at login/registration/refresh.' })
  @IsString()
  @Length(20, 200)
  refreshToken!: string;
}

export class UserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  email!: string | null;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ description: 'False until the email address has been verified (P2-02).' })
  emailVerified!: boolean;

  @ApiProperty({ nullable: true, type: String, description: 'Path of the profile photo, or null.' })
  avatarUrl!: string | null;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Short-lived JWT. Send as `Authorization: Bearer <token>`.' })
  accessToken!: string;

  @ApiProperty({
    description: 'Opaque, single-use refresh token. Rotates on every refresh; store it securely.',
  })
  refreshToken!: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: 900, description: 'Access-token lifetime in seconds.' })
  expiresIn!: number;

  @ApiProperty({ type: UserSummaryDto })
  user!: UserSummaryDto;
}
