import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AuditActorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ nullable: true, type: String })
  email!: string | null;
  @ApiProperty({ nullable: true, type: String })
  name!: string | null;
}

export class AuditEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  at!: string;

  @ApiProperty({
    type: AuditActorDto,
    nullable: true,
    description: 'Null = the system or the operator CLI.',
  })
  actor!: AuditActorDto | null;

  @ApiProperty({ example: 'booking.cancelled' })
  action!: string;

  @ApiProperty({ example: 'booking' })
  entityType!: string;

  @ApiProperty({ nullable: true, type: String })
  entityId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  reason!: string | null;

  @ApiProperty({ nullable: true, description: 'State before the change (secrets are redacted).' })
  before!: unknown;

  @ApiProperty({ nullable: true, description: 'State after the change (secrets are redacted).' })
  after!: unknown;

  @ApiProperty({ nullable: true, type: String })
  ip!: string | null;
}

export class AuditPageDto {
  @ApiProperty({ type: AuditEntryDto, isArray: true })
  items!: AuditEntryDto[];

  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class AuditQuery {
  @ApiPropertyOptional({ example: 'booking' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z_]{1,50}$/, { message: 'use a lower case entity type such as booking' })
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  entityId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({
    example: 'booking.',
    description: 'Exact action, or a prefix ending in a dot.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z_]{1,50}(\.([a-z_]{1,50})?)?$/, {
    message: 'use an action such as booking.cancelled or a prefix such as booking.',
  })
  action?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

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
