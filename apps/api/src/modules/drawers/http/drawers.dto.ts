import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class HoursDto {
  @ApiProperty({ minimum: 1, maximum: 7, description: 'ISO weekday: 1 = Monday … 7 = Sunday.' })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @ApiProperty({ example: '09:00', description: "Local time in the drawer's time zone." })
  @Matches(HHMM, { message: 'use HH:MM (24 hour)' })
  opensAt!: string;

  @ApiProperty({ example: '21:00' })
  @Matches(HHMM, { message: 'use HH:MM (24 hour)' })
  closesAt!: string;
}

export class DrawerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone!: string;

  @ApiProperty({ example: 12.9716, description: 'Degrees north (−90…90).' })
  latitude!: number;

  @ApiProperty({ example: 77.5946, description: 'Degrees east (−180…180).' })
  longitude!: number;

  @ApiProperty({ enum: ['active', 'temporarily_closed', 'inactive'] })
  status!: string;

  @ApiProperty({ nullable: true, type: String })
  pickupInstructions!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '/v1/media/0b6c1f6e-0000-4000-8000-000000000000',
    description: 'Cover photo: a path on this API (public, immutable), or null.',
  })
  photoUrl!: string | null;

  @ApiProperty({
    type: [HoursDto],
    description: 'Weekly opening hours; a missing weekday means closed.',
  })
  hours!: HoursDto[];

  @ApiProperty({ description: 'Assets in this drawer that are not retired.' })
  assetCount!: number;
}

class DrawerFields {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ minLength: 1, maxLength: 300 })
  @Transform(trim)
  @IsString()
  @Length(1, 300)
  address!: string;

  @ApiProperty({ example: 'Asia/Kolkata' })
  @IsString()
  @MaxLength(64)
  timezone!: string;

  @ApiProperty({ example: 12.9716 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 77.5946 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 1000 })
  @ValidateIf(
    (o: DrawerFields) => o.pickupInstructions !== undefined && o.pickupInstructions !== null,
  )
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  pickupInstructions?: string | null;
}

export class CreateDrawerDto extends DrawerFields {
  @ApiPropertyOptional({ type: [HoursDto], maxItems: 7 })
  @ValidateIf((o: CreateDrawerDto) => o.hours !== undefined)
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => HoursDto)
  hours?: HoursDto[];
}

export class UpdateDrawerDto {
  @ApiPropertyOptional()
  @ValidateIf((o: UpdateDrawerDto) => o.name !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateDrawerDto) => o.address !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 300)
  address?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateDrawerDto) => o.timezone !== undefined)
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ description: 'Send together with longitude.' })
  @ValidateIf((o: UpdateDrawerDto) => o.latitude !== undefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Send together with latitude.' })
  @ValidateIf((o: UpdateDrawerDto) => o.longitude !== undefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ enum: ['active', 'temporarily_closed', 'inactive'] })
  @ValidateIf((o: UpdateDrawerDto) => o.status !== undefined)
  @IsIn(['active', 'temporarily_closed', 'inactive'])
  status?: 'active' | 'temporarily_closed' | 'inactive';

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 1000 })
  @ValidateIf(
    (o: UpdateDrawerDto) => o.pickupInstructions !== undefined && o.pickupInstructions !== null,
  )
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  pickupInstructions?: string | null;
}

export class SetHoursDto {
  @ApiProperty({
    type: [HoursDto],
    maxItems: 7,
    description: 'REPLACES the weekly hours. Empty = always closed.',
  })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => HoursDto)
  hours!: HoursDto[];
}

export class ClosureDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  from!: string;

  @ApiProperty({ format: 'date-time' })
  to!: string;

  @ApiProperty({ nullable: true, type: String })
  reason!: string | null;
}

export class CreateClosureDto {
  @ApiProperty({ format: 'date-time', description: 'Inclusive start (UTC instant).' })
  @Type(() => Date)
  @IsDate()
  from!: Date;

  @ApiProperty({ format: 'date-time', description: 'Exclusive end (UTC instant).' })
  @Type(() => Date)
  @IsDate()
  to!: Date;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 500 })
  @ValidateIf((o: CreateClosureDto) => o.reason !== undefined && o.reason !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

// ── customer-facing ─────────────────────────────────────────────────────────────────────────────────
export class PublicDrawerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone!: string;

  @ApiProperty()
  latitude!: number;

  @ApiProperty()
  longitude!: number;

  @ApiProperty({ nullable: true, type: String })
  pickupInstructions!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Cover photo: a path on this API (public, immutable), or null.',
  })
  photoUrl!: string | null;

  @ApiProperty({ type: [HoursDto] })
  hours!: HoursDto[];

  @ApiProperty({
    description: "Open at this moment (hours and closures, in the drawer's time zone).",
  })
  openNow!: boolean;
}

export class NearbyRequestDto {
  @ApiProperty({
    example: 12.9716,
    description: 'Degrees north. Used for this search only; never stored or logged.',
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({
    example: 77.5946,
    description: 'Degrees east (longitude is the SECOND coordinate people mix up).',
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only suggest drawers that have a free unit of this model.',
  })
  @IsOptional()
  @IsUUID()
  itemModelId?: string;
}

export class NearbyDrawerDto extends PublicDrawerDto {
  @ApiProperty({ example: 850, description: 'Straight-line distance in meters.' })
  distanceMeters!: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Free units of the requested model right now, if one was given.',
  })
  availableNow!: number | null;

  @ApiProperty({ enum: ['closed', 'out_of_stock'], nullable: true, type: String })
  reason!: string | null;
}

export class NearbyResponseDto {
  @ApiProperty({
    type: [NearbyDrawerDto],
    description: 'Open drawers (with stock if a model was given), nearest first.',
  })
  drawers!: NearbyDrawerDto[];

  @ApiProperty({
    type: [NearbyDrawerDto],
    description: 'Close by but closed or out of stock — shown so the app can explain.',
  })
  unavailable!: NearbyDrawerDto[];
}

export class InventoryEntryDto {
  @ApiProperty({ format: 'uuid' })
  itemModelId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ type: [String] })
  photos!: string[];

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({
    example: 7900,
    description:
      'What one slot costs right now: the offer price while an offer is active, else the normal price.',
  })
  pricePerSlotPaise!: number;

  @ApiProperty({ example: 9900, description: 'The normal price of one slot (before any offer).' })
  originalPricePerSlotPaise!: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Percent off while an offer is active, else null.',
  })
  discountPercent!: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'When the active offer ends; null when there is no offer or it has no end.',
  })
  discountEndsAt!: string | null;

  @ApiProperty({ description: 'Added within the last 14 days.' })
  isNew!: boolean;

  @ApiProperty({ description: 'Marked by the staff to be featured on the home screen.' })
  featured!: boolean;

  @ApiProperty({ format: 'date-time', description: 'When the product was added.' })
  createdAt!: string;

  @ApiProperty({ example: 60 })
  slotMinutes!: number;

  @ApiProperty({ example: 60 })
  minDurationMin!: number;

  @ApiProperty({ example: 240 })
  maxDurationMin!: number;

  @ApiProperty()
  depositPaise!: number;

  @ApiProperty({ description: 'Units of this model in the drawer (not retired).' })
  total!: number;

  @ApiProperty({ description: 'Units that are rentable and free at this moment — a snapshot.' })
  availableNow!: number;
}

export class SlotDto {
  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({
    description: 'Units that could be rented from this start for at least the minimum duration.',
  })
  freeAssets!: number;

  @ApiProperty({ description: 'Longest rental in minutes that some unit can do from this start.' })
  maxFreeMinutes!: number;
}

export class AvailabilityDto {
  @ApiProperty({ format: 'uuid' })
  drawerId!: string;

  @ApiProperty({ format: 'uuid' })
  itemModelId!: string;

  @ApiProperty({
    example: '2030-01-31',
    description: "The calendar day in the drawer's time zone.",
  })
  date!: string;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone!: string;

  @ApiProperty({ example: 60 })
  slotMinutes!: number;

  @ApiProperty({ example: 60 })
  minDurationMin!: number;

  @ApiProperty({ example: 240 })
  maxDurationMin!: number;

  @ApiProperty({ example: 15 })
  bufferMin!: number;

  @ApiProperty({
    example: 7900,
    description: 'What one slot costs right now (the offer price while an offer is active).',
  })
  pricePerSlotPaise!: number;

  @ApiProperty({ example: 9900, description: 'The normal price of one slot.' })
  originalPricePerSlotPaise!: number;

  @ApiProperty({ nullable: true, type: Number })
  discountPercent!: number | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  opensAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  closesAt!: string | null;

  @ApiProperty({ type: [SlotDto] })
  slots!: SlotDto[];

  @ApiProperty({
    description:
      'Always true. Availability is a snapshot: another customer can book the last unit after this was computed, and the booking request may still answer 409 BOOKING_SLOT_TAKEN.',
  })
  snapshot!: boolean;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;
}

export class AvailabilityQuery {
  @ApiProperty({
    example: '2030-01-31',
    description: "Calendar day in the drawer's time zone (today … +90 days).",
  })
  @IsString()
  @MaxLength(10)
  date!: string;
}
