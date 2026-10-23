import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error';
import { toProblem } from '../errors/problem';

/** The single place errors leave the API: always RFC 9457 `application/problem+json`. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const problem = toProblem(exception, String(request.id));
    if (problem.status >= 500) {
      request.log.error({ err: exception }, 'unhandled exception');
    }

    if (exception instanceof AppError && exception.headers) {
      for (const [name, value] of Object.entries(exception.headers)) void reply.header(name, value);
    }
    void reply
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .send(problem);
  }
}
