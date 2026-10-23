import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class ForgotPasswordDto {
  @ApiProperty({ example: 'asha@example.com', maxLength: 254 })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'The single-use token from the emailed link (`?token=…`).' })
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({
    minLength: 10,
    maxLength: 128,
    description: 'At least 10 characters; not a common password; not your email.',
  })
  @IsString()
  @MaxLength(1000) // hard bound before any hashing; the policy enforces the real 128 limit
  newPassword!: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'The single-use token from the emailed link (`?token=…`).' })
  @IsString()
  @Length(20, 200)
  token!: string;
}
