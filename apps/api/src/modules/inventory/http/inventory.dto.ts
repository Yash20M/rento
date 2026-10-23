import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
  ValidateIf,
} from 'class-validator';
import { IsPhotoRef } from './photo-ref.validator';
import {
  ASSET_CODE_PATTERN,
  MAX_BUFFER_MINUTES,
  MAX_DURATION_MINUTES,
  MAX_PRICE_PAISE,
  MAX_SLOT_MINUTES,
} from '../domain/rules';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const toBool = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

// ── categories ─────────────────────────────────────────────────────────────────────────────────────
export class CategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Game consoles' })
  name!: string;

  @ApiProperty({ example: 'game-consoles' })
  slug!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  parentId!: string | null;

  @ApiProperty({ description: 'How many item models are in this category.' })
  itemModelCount!: number;
}

export class CreateCategoryDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({
    example: 'game-consoles',
    description: 'Derived from the name when omitted.',
  })
  @ValidateIf((o: CreateCategoryDto) => o.slug !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  slug?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @ValidateIf((o: CreateCategoryDto) => o.parentId !== undefined && o.parentId !== null)
  @IsUUID()
  parentId?: string | null;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @ValidateIf((o: UpdateCategoryDto) => o.name !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateCategoryDto) => o.slug !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  slug?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @ValidateIf((o: UpdateCategoryDto) => o.parentId !== undefined && o.parentId !== null)
  @IsUUID()
  parentId?: string | null;
}

// ── item models ────────────────────────────────────────────────────────────────────────────────────
export class ItemModelDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ example: 'PlayStation 5' })
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ type: [String], description: 'Photo URLs.' })
  photos!: string[];

  @ApiProperty({ description: 'Price of one slot, in paise (integer rupees×100).', example: 9900 })
  pricePerSlotPaise!: number;

  @ApiProperty({ example: 60, description: 'Length of one bookable slot in minutes.' })
  slotMinutes!: number;

  @ApiProperty({ example: 60 })
  minDurationMin!: number;

  @ApiProperty({ example: 240 })
  maxDurationMin!: number;

  @ApiProperty({
    example: 15,
    description: 'Cleaning / hand-over time after each rental, in minutes.',
  })
  bufferMin!: number;

  @ApiProperty({ description: 'Security deposit in paise.' })
  depositPaise!: number;

  @ApiProperty({ enum: ['active', 'inactive'] })
  status!: string;

  @ApiProperty({ description: 'Physical assets of this model that are not retired.' })
  assetCount!: number;
}

class ItemModelFields {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 2000 })
  @ValidateIf((o: ItemModelFields) => o.description !== undefined && o.description !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 10,
    description: 'https URLs or `/v1/media/<id>` paths of uploaded photos.',
  })
  @ValidateIf((o: ItemModelFields) => o.photos !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @IsPhotoRef({ each: true })
  @MaxLength(500, { each: true })
  photos?: string[];

  @ApiProperty({ minimum: 0, maximum: MAX_PRICE_PAISE })
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_PAISE)
  pricePerSlotPaise!: number;

  @ApiProperty({ minimum: 5, maximum: MAX_SLOT_MINUTES })
  @IsInt()
  @Min(5)
  @Max(MAX_SLOT_MINUTES)
  slotMinutes!: number;

  @ApiProperty({ minimum: 5, maximum: MAX_DURATION_MINUTES })
  @IsInt()
  @Min(5)
  @Max(MAX_DURATION_MINUTES)
  minDurationMin!: number;

  @ApiProperty({ minimum: 5, maximum: MAX_DURATION_MINUTES })
  @IsInt()
  @Min(5)
  @Max(MAX_DURATION_MINUTES)
  maxDurationMin!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_BUFFER_MINUTES, default: 0 })
  @ValidateIf((o: ItemModelFields) => o.bufferMin !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_BUFFER_MINUTES)
  bufferMin?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_PRICE_PAISE, default: 0 })
  @ValidateIf((o: ItemModelFields) => o.depositPaise !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_PAISE)
  depositPaise?: number;
}

export class CreateItemModelDto extends ItemModelFields {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;
}

export class UpdateItemModelDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((o: UpdateItemModelDto) => o.categoryId !== undefined)
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @ValidateIf((o: UpdateItemModelDto) => o.name !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 2000 })
  @ValidateIf((o: UpdateItemModelDto) => o.description !== undefined && o.description !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: 10 })
  @ValidateIf((o: UpdateItemModelDto) => o.photos !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @IsPhotoRef({ each: true })
  @MaxLength(500, { each: true })
  photos?: string[];

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateItemModelDto) => o.pricePerSlotPaise !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_PAISE)
  pricePerSlotPaise?: number;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateItemModelDto) => o.slotMinutes !== undefined)
  @IsInt()
  @Min(5)
  @Max(MAX_SLOT_MINUTES)
  slotMinutes?: number;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateItemModelDto) => o.minDurationMin !== undefined)
  @IsInt()
  @Min(5)
  @Max(MAX_DURATION_MINUTES)
  minDurationMin?: number;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateItemModelDto) => o.maxDurationMin !== undefined)
  @IsInt()
  @Min(5)
  @Max(MAX_DURATION_MINUTES)
  maxDurationMin?: number;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateItemModelDto) => o.bufferMin !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_BUFFER_MINUTES)
  bufferMin?: number;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateItemModelDto) => o.depositPaise !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_PAISE)
  depositPaise?: number;

  @ApiPropertyOptional({
    enum: ['active', 'inactive'],
    description: 'Models are deactivated, never deleted.',
  })
  @ValidateIf((o: UpdateItemModelDto) => o.status !== undefined)
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class ItemModelQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Include deactivated models (administrators only).' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  includeInactive?: boolean;
}

// ── assets ─────────────────────────────────────────────────────────────────────────────────────────
export class AssetDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'PS5-001' })
  assetCode!: string;

  @ApiProperty({ format: 'uuid' })
  itemModelId!: string;

  @ApiProperty()
  itemModelName!: string;

  @ApiProperty({ format: 'uuid' })
  drawerId!: string;

  @ApiProperty()
  drawerName!: string;

  @ApiProperty({ nullable: true, type: String })
  serialNo!: string | null;

  @ApiProperty({ enum: ['available', 'maintenance', 'in_transfer', 'retired'] })
  status!: string;
}

export class AssetPageDto {
  @ApiProperty({ type: [AssetDto] })
  data!: AssetDto[];

  @ApiProperty({
    description: 'Pass as `cursor` to fetch the next page; null on the last page.',
    nullable: true,
    type: String,
  })
  nextCursor!: string | null;
}

export class CreateAssetDto {
  @ApiProperty({
    example: 'PS5-001',
    description: 'Unique human-readable code (letters, digits, . _ -).',
  })
  @Transform(trim)
  @IsString()
  @Matches(ASSET_CODE_PATTERN, { message: 'use 2–40 letters, digits, dot, underscore or hyphen' })
  assetCode!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemModelId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  drawerId!: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 100 })
  @ValidateIf((o: CreateAssetDto) => o.serialNo !== undefined && o.serialNo !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  serialNo?: string | null;
}

export class UpdateAssetDto {
  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 100 })
  @ValidateIf((o: UpdateAssetDto) => o.serialNo !== undefined && o.serialNo !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  serialNo?: string | null;

  @ApiPropertyOptional({
    enum: ['available', 'maintenance', 'retired'],
    description: '`in_transfer` is set by the transfer workflow only. `retired` is final.',
  })
  @ValidateIf((o: UpdateAssetDto) => o.status !== undefined)
  @IsIn(['available', 'maintenance', 'retired'])
  status?: 'available' | 'maintenance' | 'retired';
}

export class AssetQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  drawerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  itemModelId?: string;

  @ApiPropertyOptional({ enum: ['available', 'maintenance', 'in_transfer', 'retired'] })
  @IsOptional()
  @IsIn(['available', 'maintenance', 'in_transfer', 'retired'])
  status?: string;

  @ApiPropertyOptional({ description: 'Part of the asset code.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  q?: string;

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
  @MaxLength(200)
  cursor?: string;
}

export class StartTransferDto {
  @ApiProperty({ format: 'uuid', description: 'The drawer the asset is moving to.' })
  @IsUUID()
  toDrawerId!: string;

  @ApiProperty({ minLength: 3, maxLength: 500, description: 'Why — kept in the audit trail.' })
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class TransferDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  assetId!: string;
  @ApiProperty()
  assetCode!: string;
  @ApiProperty({ format: 'uuid' })
  fromDrawerId!: string;
  @ApiProperty({ format: 'uuid' })
  toDrawerId!: string;
  @ApiProperty({ enum: ['in_transit', 'completed', 'cancelled'] })
  status!: string;
  @ApiProperty()
  reason!: string;
  @ApiProperty({ format: 'date-time' })
  startedAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  finishedAt!: string | null;
}
