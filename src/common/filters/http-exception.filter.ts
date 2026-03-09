import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from '../interfaces/error-response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const typedResponse = exceptionResponse as {
        message?: string | string[];
        error?: string;
      };

      message = typedResponse.message ?? message;
      error = typedResponse.error ?? error;
    }

    if (exception instanceof HttpException) {
      error = exception.name;
    }

    const payload: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      method: request.method,
      requestId: request.headers['x-request-id'] as string | undefined,
      error,
      message,
    };

    const stack = exception instanceof Error ? exception.stack : undefined;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} failed with ${status}`,
        stack,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.originalUrl} failed with ${status}`,
      );
    }

    response.status(status).json(payload);
  }
}
