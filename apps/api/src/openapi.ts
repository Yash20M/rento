import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ProblemDetailsDto } from './common/errors/problem.dto';

export const API_VERSION = '0.1.0';

export function buildOpenApiDocument(app: INestApplication) {
  const options = new DocumentBuilder()
    .setTitle('Rento API')
    .setDescription('Time-based rental platform API. Errors are RFC 9457 problem+json.')
    .setVersion(API_VERSION)
    .addBearerAuth(undefined, 'bearer')
    .build();
  // ProblemDetailsDto is referenced by `$ref` only, so register it explicitly.
  return SwaggerModule.createDocument(app, options, { extraModels: [ProblemDetailsDto] });
}

/** Serves Swagger UI at /docs and the raw document at /docs-json. Call only when docs are enabled. */
export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), { jsonDocumentUrl: 'docs-json' });
}
