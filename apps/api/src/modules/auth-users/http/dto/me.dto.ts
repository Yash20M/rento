import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class IdentityDto {
  @ApiProperty({ enum: ['password', 'google', 'facebook', 'apple'] })
  provider!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Email the provider reported for this sign-in method.',
  })
  email!: string | null;

  @ApiProperty({ description: 'Whether the provider vouched for that email.' })
  emailVerified!: boolean;

  @ApiProperty({ format: 'date-time' })
  linkedAt!: string;
}

/**
 * Every field is optional but, when present, must be valid: `null` is not "clear this field". The ValidateIf guards
 * (instead of IsOptional) are what make `{ "phone": null }` a 422.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @ValidateIf((o: UpdateProfileDto) => o.name !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ example: '+919876543210', description: 'E.164 format.' })
  @ValidateIf((o: UpdateProfileDto) => o.phone !== undefined)
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format, e.g. +919876543210' })
  phone?: string;

  @ApiPropertyOptional({
    maxLength: 254,
    description:
      'Only while the account has no email. The address is attached once the link mailed to it is used.',
  })
  @ValidateIf((o: UpdateProfileDto) => o.email !== undefined)
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email?: string;
}

export class ProfileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  email!: string | null;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ nullable: true, type: String })
  phone!: string | null;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '/v1/media/0b6c1f6e-0000-4000-8000-000000000000',
    description: 'Your profile photo: a path on this API (public, immutable), or null.',
  })
  avatarUrl!: string | null;

  @ApiProperty({
    enum: ['email', 'phone'],
    isArray: true,
    description:
      'Profile fields the app should still collect (`email` while the account has none).',
  })
  needsProfileCompletion!: Array<'email' | 'phone'>;
}

export class DeleteAccountDto {
  @ApiPropertyOptional({
    description:
      'Your password, to prove it is you. Required for accounts that have one; accounts that use only Google, Meta or Apple must have signed in recently instead.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  password?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Your current password.' })
  @IsString()
  @MaxLength(1000)
  currentPassword!: string;

  @ApiProperty({
    description:
      'The new password (same rules as when you registered; must differ from the current one).',
  })
  @IsString()
  @MaxLength(1000)
  newPassword!: string;
}
