import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';
}

export class ReadinessChecksDto {
  @ApiProperty({ enum: ['up'], example: 'up' })
  database!: 'up';
}

export class ReadinessResponseDto {
  @ApiProperty({ enum: ['ready'], example: 'ready' })
  status!: 'ready';

  @ApiProperty({ type: ReadinessChecksDto })
  checks!: ReadinessChecksDto;
}
