import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const requestId = request.header('x-request-id') ?? randomUUID();

    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      const duration = Date.now() - startedAt;

      this.logger.log(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: duration,
        }),
      );
    });

    next();
  }
}
