import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RoleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Support Agent' })
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({
    description: 'System roles (the Super Admin) are locked: they cannot be edited or deleted.',
  })
  isSystem!: boolean;

  @ApiProperty({
    description:
      'The Super Admin holds every permission implicitly, including future ones; its `permissions` list is empty.',
  })
  isSuperAdmin!: boolean;

  @ApiProperty({
    type: [String],
    example: ['bookings:read', 'users:read'],
    description: 'Sorted permission keys.',
  })
  permissions!: string[];

  @ApiProperty({ description: 'How many people currently hold this role.' })
  assignedCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CreateRoleDto {
  @ApiProperty({ minLength: 1, maxLength: 100, description: 'Unique, ignoring case.' })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 500 })
  @ValidateIf((o: CreateRoleDto) => o.description !== undefined && o.description !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Permission keys from `GET /v1/admin/permissions`. Defaults to none.',
  })
  @ValidateIf((o: CreateRoleDto) => o.permissions !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  permissions?: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @ValidateIf((o: UpdateRoleDto) => o.name !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 500 })
  @ValidateIf((o: UpdateRoleDto) => o.description !== undefined && o.description !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: "When present, REPLACES the role's permission set.",
  })
  @ValidateIf((o: UpdateRoleDto) => o.permissions !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  permissions?: string[];
}

export class PermissionDto {
  @ApiProperty({ example: 'bookings:read' })
  key!: string;

  @ApiProperty()
  description!: string;
}

export class PermissionGroupDto {
  @ApiProperty({ example: 'Bookings' })
  group!: string;

  @ApiProperty({ type: [PermissionDto] })
  permissions!: PermissionDto[];
}
