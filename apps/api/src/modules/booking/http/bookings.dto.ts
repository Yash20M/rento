import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
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

export const BOOKING_STATUSES = [
  'held',
  'confirmed',
  'active',
  'overdue',
  'completed',
  'cancelled',
  'expired',
  'no_show',
] as const;

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  drawerId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemModelId!: string;

  @ApiProperty({
    example: '2030-01-07T04:00:00.000Z',
    description: 'Start instant with a UTC offset, on a whole minute.',
  })
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, {
    message: 'include the UTC offset, for example 2030-01-07T04:00:00Z',
  })
  startsAt!: string;

  @ApiProperty({
    example: 60,
    description: 'A multiple of the slot length, within the min/max of the model.',
  })
  @IsInt()
  @Min(1)
  @Max(100_000)
  durationMinutes!: number;
}

export class BookingDrawerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  address!: string;
  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone!: string;
}

export class BookingItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Cover photo of the product: a path on this API (public) or a link, or null.',
  })
  photoUrl!: string | null;
}

export class BookingPaymentDto {
  @ApiProperty({ enum: ['created', 'captured', 'failed', 'refunded'] })
  status!: string;
  @ApiProperty({ description: 'Gateway order the customer pays.' })
  orderId!: string;
  @ApiProperty({ description: 'Paise.' })
  amountPaise!: number;
}

export class BookingRefundDto {
  @ApiProperty({ description: 'Paise.' })
  amountPaise!: number;
  @ApiProperty({ enum: ['pending', 'processed', 'failed'] })
  status!: string;
}

export class BookingDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: BOOKING_STATUSES })
  status!: string;

  @ApiProperty({ type: BookingDrawerDto })
  drawer!: BookingDrawerDto;

  @ApiProperty({ type: BookingItemDto })
  itemModel!: BookingItemDto;

  @ApiProperty({ example: 'PS5-001', description: 'Which physical unit was reserved.' })
  assetCode!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty({ description: 'Rental price in paise: what is charged (after any offer).' })
  pricePaise!: number;

  @ApiProperty({
    description:
      'What the customer saved thanks to an offer, in paise (0 without one). Price + savings = the normal price.',
  })
  discountPaise!: number;

  @ApiProperty({ description: 'Deposit in paise.' })
  depositPaise!: number;

  @ApiProperty({ description: 'What the customer pays: rental + deposit, in paise.' })
  totalPaise!: number;

  @ApiProperty({ example: 'INR' })
  currency!: string;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    description: 'While `held`: the payment must complete before this instant.',
  })
  holdExpiresAt!: string | null;

  @ApiProperty({ description: 'True while the customer may still cancel.' })
  cancellable!: boolean;

  @ApiProperty({ nullable: true, type: String })
  cancelReason!: string | null;

  @ApiProperty({ type: BookingPaymentDto, nullable: true })
  payment!: BookingPaymentDto | null;

  @ApiProperty({ type: BookingRefundDto, nullable: true })
  refund!: BookingRefundDto | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PaymentOrderDto {
  @ApiProperty({ example: 'fake' })
  provider!: string;
  @ApiProperty()
  orderId!: string;
  @ApiProperty({ description: 'Paise.' })
  amountPaise!: number;
  @ApiProperty({ example: 'INR' })
  currency!: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  holdExpiresAt!: string | null;
}

export class ConfirmPaymentDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  orderId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  paymentId!: string;

  @ApiProperty({ description: 'The gateway signature over order and payment id.' })
  @IsString()
  @Length(1, 500)
  signature!: string;
}

export class SimulatedCheckoutDto {
  @ApiProperty()
  orderId!: string;
  @ApiProperty()
  paymentId!: string;
  @ApiProperty()
  signature!: string;
}

export class MyBookingsQuery {
  @ApiPropertyOptional({ enum: BOOKING_STATUSES })
  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: string;
}

export class AdminCancelDto {
  @ApiProperty({ minLength: 3, maxLength: 500, description: 'Why — shown in the audit trail.' })
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason!: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    description: 'Override the refund percentage of the rental price. Needs `bookings:refund`.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  refundPercent?: number;
}

export class AdminBookingsQuery {
  @ApiPropertyOptional({ enum: BOOKING_STATUSES })
  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  drawerId?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Bookings ending after this instant.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Bookings starting before this instant.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ description: 'Customer email or name, asset code or booking id.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: '`nextCursor` of the previous page.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  cursor?: string;
}

export class BookingEventDto {
  @ApiProperty({ nullable: true, type: String })
  from!: string | null;
  @ApiProperty()
  to!: string;
  @ApiProperty({ nullable: true, type: String, description: 'Who did it; null = the system.' })
  actorUserId!: string | null;
  @ApiProperty({ nullable: true, type: String })
  note!: string | null;
  @ApiProperty({ format: 'date-time' })
  at!: string;
}

export class BookingCustomerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ nullable: true, type: String })
  email!: string | null;
  @ApiProperty({ nullable: true, type: String })
  name!: string | null;
}

export class AdminBookingDto extends BookingDto {
  @ApiProperty({ type: BookingCustomerDto })
  customer!: BookingCustomerDto;
}

export class AdminBookingDetailDto extends AdminBookingDto {
  @ApiProperty({ type: BookingEventDto, isArray: true })
  history!: BookingEventDto[];
}

export class AdminBookingPageDto {
  @ApiProperty({ type: AdminBookingDto, isArray: true })
  items!: AdminBookingDto[];
  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class ExtendBookingDto {
  @ApiProperty({ example: 30, description: 'A multiple of the slot length.' })
  @IsInt()
  @Min(1)
  @Max(100_000)
  extraMinutes!: number;
}

export class ExtensionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  extraMinutes!: number;
  @ApiProperty({ description: 'Extra price in paise.' })
  pricePaise!: number;
  @ApiProperty({ format: 'date-time', description: 'When the rental would end.' })
  newEndsAt!: string;
  @ApiProperty({ description: 'Gateway order for the extra amount.' })
  orderId!: string;
  @ApiProperty({ example: 'fake' })
  provider!: string;
}
