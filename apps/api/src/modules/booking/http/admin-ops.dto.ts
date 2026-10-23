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
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// ── reassign ─────────────────────────────────────────────────────────────────────────────────────────
export class ReassignDto {
  @ApiProperty({ minLength: 3, maxLength: 500, description: 'Why — kept in the audit trail.' })
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The unit to move to. Omit to pick the first free unit of the same model.',
  })
  @IsOptional()
  @IsUUID()
  assetId?: string;
}

export class ReassignOptionDto {
  @ApiProperty({ format: 'uuid' })
  assetId!: string;
  @ApiProperty()
  assetCode!: string;
}

// ── blocks ───────────────────────────────────────────────────────────────────────────────────────────
export const BLOCK_KINDS = ['maintenance', 'admin_block'] as const;

export class BlockDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  assetId!: string;
  @ApiProperty({ enum: ['maintenance', 'admin_block', 'transfer'] })
  kind!: string;
  @ApiProperty({ format: 'date-time' })
  startsAt!: string;
  @ApiProperty({ format: 'date-time' })
  endsAt!: string;
  @ApiProperty({ nullable: true, type: String })
  reason!: string | null;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class CreateBlockDto {
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  endsAt!: string;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason!: string;

  @ApiPropertyOptional({ enum: BLOCK_KINDS, default: 'maintenance' })
  @IsOptional()
  @IsIn(BLOCK_KINDS)
  kind?: (typeof BLOCK_KINDS)[number];
}

export class WindowQuery {
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  endsAt!: string;
}

export class ImpactBookingDto {
  @ApiProperty({ format: 'uuid' })
  bookingId!: string;
  @ApiProperty()
  status!: string;
  @ApiProperty({ format: 'date-time' })
  startsAt!: string;
  @ApiProperty({ format: 'date-time' })
  endsAt!: string;
  @ApiProperty({ nullable: true, type: String })
  customer!: string | null;
}

export class ImpactDto {
  @ApiProperty({ type: ImpactBookingDto, isArray: true })
  bookings!: ImpactBookingDto[];
  @ApiProperty({ type: BlockDto, isArray: true })
  blocks!: BlockDto[];
  @ApiProperty({ description: 'True when nothing is in the way: the block can be created now.' })
  clear!: boolean;
}

// ── schedule ─────────────────────────────────────────────────────────────────────────────────────────
export class ScheduleQuery extends WindowQuery {}

export class ScheduleEntryDto {
  @ApiProperty({ enum: ['booking', 'maintenance', 'admin_block', 'transfer'] })
  kind!: string;
  @ApiProperty({ format: 'date-time', description: 'Start of the time the unit is blocked.' })
  blockedFrom!: string;
  @ApiProperty({
    format: 'date-time',
    description: 'End of the blocked time (includes the cleaning buffer).',
  })
  blockedUntil!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  bookingId?: string;
  @ApiPropertyOptional()
  bookingStatus?: string;
  @ApiPropertyOptional({ format: 'date-time', description: "The rental's own start." })
  startsAt?: string;
  @ApiPropertyOptional({ format: 'date-time', description: "The rental's own end." })
  endsAt?: string;
  @ApiPropertyOptional()
  customer?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  blockId?: string;
  @ApiPropertyOptional()
  reason?: string;
}

export class ScheduleAssetDto {
  @ApiProperty({ format: 'uuid' })
  assetId!: string;
  @ApiProperty()
  assetCode!: string;
  @ApiProperty()
  itemModel!: string;
  @ApiProperty()
  status!: string;
  @ApiProperty({ type: ScheduleEntryDto, isArray: true })
  entries!: ScheduleEntryDto[];
}

export class ScheduleDto {
  @ApiProperty({ format: 'uuid' })
  drawerId!: string;
  @ApiProperty()
  drawerName!: string;
  @ApiProperty({ description: 'IANA time zone the times should be shown in.' })
  timezone!: string;
  @ApiProperty({ type: ScheduleAssetDto, isArray: true })
  assets!: ScheduleAssetDto[];
}

// ── reports ──────────────────────────────────────────────────────────────────────────────────────────
export class ReportQuery {
  @ApiProperty({ format: 'date-time', description: 'Bookings confirmed from this instant.' })
  @IsISO8601({ strict: true })
  from!: string;

  @ApiProperty({ format: 'date-time', description: 'Bookings confirmed before this instant.' })
  @IsISO8601({ strict: true })
  to!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  drawerId?: string;
}

export class ReportTotalsDto {
  @ApiProperty() bookings!: number;
  @ApiProperty() completed!: number;
  @ApiProperty() cancelled!: number;
  @ApiProperty() noShow!: number;
  @ApiProperty({ description: 'Hours rented out (completed, running and upcoming bookings).' })
  rentedHours!: number;
  @ApiProperty({ description: 'Money taken, including refundable deposits.' })
  collectedPaise!: number;
  @ApiProperty() refundedPaise!: number;
  @ApiProperty() netPaise!: number;
}

export class ReportDayDto {
  @ApiProperty({ description: 'Calendar day in the drawer’s time zone, YYYY-MM-DD.' })
  day!: string;
  @ApiProperty() bookings!: number;
  @ApiProperty() collectedPaise!: number;
}

export class ReportRowDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() bookings!: number;
  @ApiProperty() rentedHours!: number;
  @ApiProperty() collectedPaise!: number;
}

export class ReportDto {
  @ApiProperty({ type: ReportTotalsDto })
  totals!: ReportTotalsDto;
  @ApiProperty({ type: ReportDayDto, isArray: true })
  days!: ReportDayDto[];
  @ApiProperty({ type: ReportRowDto, isArray: true })
  drawers!: ReportRowDto[];
  @ApiProperty({ type: ReportRowDto, isArray: true })
  models!: ReportRowDto[];
}

// ── payments ledger ──────────────────────────────────────────────────────────────────────────────────
export class PaymentsQuery {
  @ApiPropertyOptional({ enum: ['created', 'captured', 'failed', 'refunded'] })
  @IsOptional()
  @IsIn(['created', 'captured', 'failed', 'refunded'])
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  drawerId?: string;

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

export class PaymentLedgerRowDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) bookingId!: string;
  @ApiProperty({ nullable: true, type: String }) customer!: string | null;
  @ApiProperty() drawerName!: string;
  @ApiProperty() provider!: string;
  @ApiProperty() status!: string;
  @ApiProperty() amountPaise!: number;
  @ApiProperty({ description: 'True for the payment of an extension.' }) extension!: boolean;
  @ApiProperty({ nullable: true, type: Number }) refundedPaise!: number | null;
  @ApiProperty({ nullable: true, type: String }) refundStatus!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class PaymentLedgerPageDto {
  @ApiProperty({ type: PaymentLedgerRowDto, isArray: true })
  items!: PaymentLedgerRowDto[];
  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

// ── settings (read only) ─────────────────────────────────────────────────────────────────────────────
export class RefundTierDto {
  @ApiProperty() minutesBeforeStart!: number;
  @ApiProperty() percent!: number;
}

export class SettingsDto {
  @ApiProperty() holdMinutes!: number;
  @ApiProperty() bookingMinLeadMinutes!: number;
  @ApiProperty() bookingMaxAdvanceDays!: number;
  @ApiProperty({ type: RefundTierDto, isArray: true }) refundTiers!: RefundTierDto[];
  @ApiProperty() pickupEarlyMinutes!: number;
  @ApiProperty() noShowGraceMinutes!: number;
  @ApiProperty() discoveryRadiusMeters!: number;
  @ApiProperty() discoveryMaxResults!: number;
  @ApiProperty() kycRequired!: boolean;
  @ApiProperty({ enum: ['fake', 'razorpay'] }) paymentProvider!: string;
  @ApiProperty({
    description: 'True while the demo (fake) gateway is in use: no real money moves.',
  })
  paymentDemoMode!: boolean;
  @ApiProperty({ description: 'Whether the Razorpay webhook secret is configured.' })
  webhookConfigured!: boolean;
  @ApiProperty() jobsIntervalSeconds!: number;
}
