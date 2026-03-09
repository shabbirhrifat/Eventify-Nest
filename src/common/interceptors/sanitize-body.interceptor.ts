import { ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/[<>]/g, '');
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sanitizeValue(nestedValue),
      ]),
    );
  }

  return value;
}

@Injectable()
export class SanitizeBodyInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: { handle: () => Observable<unknown> },
  ) {
    const request = context.switchToHttp().getRequest<{ body?: unknown }>();

    if (request.body) {
      request.body = sanitizeValue(request.body);
    }

    return next.handle();
  }
}
