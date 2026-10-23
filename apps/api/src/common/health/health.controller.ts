import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { AppError } from '../errors/app-error';
import { PROBLEM_JSON, ProblemDetailsDto } from '../errors/problem.dto';
import { DATABASE_PING, type DatabasePing } from './database-ping';
import { HealthResponseDto, ReadinessResponseDto } from './health.dto';
import { ShutdownState } from './shutdown-state';

@ApiTags('ops')
@Controller()
export class HealthController {
  constructor(
    @Inject(DATABASE_PING) private readonly database: DatabasePing,
    private readonly shutdownState: ShutdownState,
  ) {}

  /** Liveness: the process is up. No dependency checks. */
  @Get('healthz')
  @ApiOkResponse({ type: HealthResponseDto })
  healthz(): HealthResponseDto {
    return { status: 'ok' };
  }

  /** Readiness: able to serve traffic (database reachable, not draining). */
  @Get('readyz')
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiResponse({
    status: 503,
    description: 'Database unavailable or shutting down (`RETRY_LATER`).',
    content: { [PROBLEM_JSON]: { schema: { $ref: getSchemaPath(ProblemDetailsDto) } } },
  })
  async readyz(): Promise<ReadinessResponseDto> {
    if (this.shutdownState.isDraining) {
      throw new AppError({ status: 503, code: 'RETRY_LATER', detail: 'Service is shutting down' });
    }
    try {
      await this.database.ping();
    } catch {
      throw new AppError({ status: 503, code: 'RETRY_LATER', detail: 'Database unavailable' });
    }
    return { status: 'ready', checks: { database: 'up' } };
  }
}
