import { ApiProperty } from '@nestjs/swagger';
import { ErrorCode } from './error-codes';

/** OpenAPI description of one field-level validation error. */
export class FieldErrorDto {
  @ApiProperty({ example: 'quantity', description: 'Dotted path of the offending field.' })
  field!: string;

  @ApiProperty({ example: 'quantity must not be less than 1' })
  message!: string;
}

/** OpenAPI description of the RFC 9457 `application/problem+json` body (README §14.1). */
export class ProblemDetailsDto {
  @ApiProperty({ example: 'urn:rento:problem:validation-failed' })
  type!: string;

  @ApiProperty({ example: 'Unprocessable Entity' })
  title!: string;

  @ApiProperty({ example: 422 })
  status!: number;

  @ApiProperty({
    enum: Object.values(ErrorCode),
    enumName: 'ErrorCode',
    description:
      'Stable machine-readable code (README §14.2). Clients branch on this, never on `detail`.',
  })
  code!: ErrorCode;

  @ApiProperty({ example: 'Request validation failed' })
  detail!: string;

  @ApiProperty({ type: [FieldErrorDto], required: false })
  errors?: FieldErrorDto[];

  @ApiProperty({ description: 'Equals the `X-Request-Id` response header.' })
  traceId!: string;
}

export const PROBLEM_JSON = 'application/problem+json';
