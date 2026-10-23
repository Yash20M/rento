import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const KYC_STATES = ['none', 'pending', 'verified', 'rejected'] as const;

export class KycStatusDto {
  @ApiProperty({ description: 'Whether this deployment requires verification before booking.' })
  required!: boolean;

  @ApiProperty({ enum: KYC_STATES })
  status!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'XXXX XXXX 1234',
    description: 'Only the last four digits are ever shown.',
  })
  maskedAadhaar!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  verifiedAt!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Name returned by the verification service.',
  })
  verifiedName!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Why a staff member declined it.' })
  reason!: string | null;
}

export class StartAadhaarDto {
  @ApiProperty({
    example: '2345 6789 0124',
    description:
      '12 digits; spaces allowed. Never stored — only the last four digits and a keyed hash are kept.',
  })
  @IsString()
  @Length(12, 20)
  @Matches(/^[0-9 -]+$/, { message: 'use digits only' })
  aadhaarNumber!: string;
}

export class AadhaarRequestDto {
  @ApiProperty({ format: 'uuid' })
  requestId!: string;
  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
  @ApiProperty({ example: 'XXXX XXXX 1234' })
  maskedAadhaar!: string;
}

export class VerifyAadhaarDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  requestId!: string;

  @ApiProperty({
    example: '123456',
    description: 'The one-time code sent to the phone linked to the Aadhaar.',
  })
  @IsString()
  @Matches(/^[0-9]{4,8}$/, { message: 'enter the digits of the code' })
  otp!: string;
}

export class CustomerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ nullable: true, type: String })
  email!: string | null;
  @ApiProperty({ nullable: true, type: String })
  name!: string | null;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ enum: KYC_STATES })
  kycStatus!: string;
  @ApiProperty({ nullable: true, type: String })
  maskedAadhaar!: string | null;
  @ApiProperty({ description: 'Bookings ever made (held ones included).' })
  bookingCount!: number;
  @ApiProperty({
    enum: ['active', 'suspended'],
    description: 'A suspended customer cannot sign in or book.',
  })
  accountStatus!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Profile photo path (public), or null.',
  })
  avatarUrl!: string | null;
  @ApiProperty({ description: 'Whether the customer has verified their email address.' })
  emailVerified!: boolean;
}

export class AccountStatusDto {
  @ApiProperty({ enum: ['active', 'suspended'] })
  @IsIn(['active', 'suspended'])
  status!: string;

  @ApiProperty({ minLength: 3, maxLength: 500, description: 'Why — kept in the audit trail.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class CustomerDetailDto extends CustomerDto {
  @ApiProperty({ type: KycStatusDto })
  kyc!: KycStatusDto;
  @ApiProperty({ description: 'Bookings currently held, confirmed or running.' })
  activeBookings!: number;
}

export class CustomerPageDto {
  @ApiProperty({ type: CustomerDto, isArray: true })
  items!: CustomerDto[];
  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class CustomersQuery {
  @ApiPropertyOptional({ description: 'Email or name.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: KYC_STATES })
  @IsOptional()
  @IsIn(KYC_STATES)
  kyc?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  cursor?: string;
}

export class KycDecisionDto {
  @ApiProperty({
    enum: ['approve', 'reject', 'reset'],
    description: '`reset` forgets the result so the customer can verify again.',
  })
  @IsIn(['approve', 'reject', 'reset'])
  decision!: 'approve' | 'reject' | 'reset';

  @ApiProperty({ minLength: 3, maxLength: 500, description: 'Why — kept in the audit log.' })
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason!: string;
}
