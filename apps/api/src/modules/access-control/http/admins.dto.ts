import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class AssignmentInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'Limit the role to one drawer. Omit or null for all drawers.',
  })
  @ValidateIf((o: AssignmentInputDto) => o.drawerId !== undefined && o.drawerId !== null)
  @IsUUID()
  drawerId?: string | null;
}

export class InviteAdminDto {
  @ApiProperty({ example: 'agent@example.com', maxLength: 254 })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ type: [AssignmentInputDto], minItems: 1, maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AssignmentInputDto)
  roles!: AssignmentInputDto[];
}

export class SetRolesDto {
  @ApiProperty({
    type: [AssignmentInputDto],
    maxItems: 20,
    description: "REPLACES the person's assignments. An empty list removes all admin access.",
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AssignmentInputDto)
  roles!: AssignmentInputDto[];
}

export class AcceptInvitationDto {
  @ApiProperty({ description: 'The token from the invitation link.' })
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({ minLength: 10, maxLength: 128, description: 'Same policy as registration.' })
  @IsString()
  @MaxLength(1000)
  password!: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;
}

export class AcceptInvitationGoogleDto {
  @ApiProperty({ description: 'The token from the invitation link.' })
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({ description: 'Google ID token; its verified email must be the invited address.' })
  @IsString()
  @Length(1, 8192)
  idToken!: string;
}

export class AssignmentDto {
  @ApiProperty({ format: 'uuid' })
  roleId!: string;

  @ApiProperty()
  roleName!: string;

  @ApiProperty()
  isSuperAdmin!: boolean;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  drawerId!: string | null;
}

export class AdminDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  email!: string | null;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ enum: ['active', 'suspended', 'deleted'] })
  status!: string;

  @ApiProperty({ type: [AssignmentDto], description: 'Empty once admin access was removed.' })
  roles!: AssignmentDto[];
}

export class InvitedRoleDto {
  @ApiProperty({ format: 'uuid' })
  roleId!: string;

  @ApiProperty()
  roleName!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  drawerId!: string | null;
}

export class InvitationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ format: 'uuid' })
  invitedBy!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: [InvitedRoleDto] })
  roles!: InvitedRoleDto[];
}
