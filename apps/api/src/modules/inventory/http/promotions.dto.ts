import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { PROMOTION_THEMES } from '../domain/promotion-rules';
import { IsInstant } from './instant.decorator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** What the customer app shows: only what a banner needs. */
export class PublicPromotionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Weekend offer' })
  title!: string;

  @ApiProperty({ nullable: true, type: String })
  subtitle!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Label of the button, e.g. "Shop now".',
  })
  ctaLabel!: string | null;

  @ApiProperty({
    enum: PROMOTION_THEMES,
    description: 'Colour of the banner when it has no picture.',
  })
  theme!: string;

  @ApiProperty({ nullable: true, type: String, description: 'A `/v1/media/<id>` path, or null.' })
  imageUrl!: string | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description:
      'The product the banner opens; null when none, or when that product is off the shelf.',
  })
  itemModelId!: string | null;
}

/** What staff see and edit: everything, plus where the banner is on the calendar. */
export class PromotionDto extends PublicPromotionDto {
  @ApiProperty({ nullable: true, type: String, description: 'Name of the product it opens.' })
  itemModelName!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  startsAt!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  endsAt!: string | null;

  @ApiProperty({ description: 'The on/off switch.' })
  active!: boolean;

  @ApiProperty({ description: 'Lower numbers come first.' })
  sortOrder!: number;

  @ApiProperty({
    enum: ['live', 'scheduled', 'ended', 'off'],
    description: 'What customers see right now.',
  })
  state!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

class PromotionFields {
  @ApiPropertyOptional({ nullable: true, type: String, minLength: 1, maxLength: 160 })
  @ValidateIf((o: PromotionFields) => o.subtitle !== undefined && o.subtitle !== null)
  @Transform(trim)
  @IsString()
  @Length(1, 160)
  subtitle?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, minLength: 1, maxLength: 30 })
  @ValidateIf((o: PromotionFields) => o.ctaLabel !== undefined && o.ctaLabel !== null)
  @Transform(trim)
  @IsString()
  @Length(1, 30)
  ctaLabel?: string | null;

  @ApiPropertyOptional({ enum: PROMOTION_THEMES, default: 'orange' })
  @ValidateIf((o: PromotionFields) => o.theme !== undefined)
  @IsIn(PROMOTION_THEMES)
  theme?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @ValidateIf((o: PromotionFields) => o.itemModelId !== undefined && o.itemModelId !== null)
  @IsUUID()
  itemModelId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  @ValidateIf((o: PromotionFields) => o.startsAt !== undefined && o.startsAt !== null)
  @IsInstant()
  startsAt?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  @ValidateIf((o: PromotionFields) => o.endsAt !== undefined && o.endsAt !== null)
  @IsInstant()
  endsAt?: string | null;

  @ApiPropertyOptional({ default: true })
  @ValidateIf((o: PromotionFields) => o.active !== undefined)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 10_000, default: 0 })
  @ValidateIf((o: PromotionFields) => o.sortOrder !== undefined)
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class CreatePromotionDto extends PromotionFields {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  title!: string;
}

export class UpdatePromotionDto extends PromotionFields {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @ValidateIf((o: UpdatePromotionDto) => o.title !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  title?: string;
}
