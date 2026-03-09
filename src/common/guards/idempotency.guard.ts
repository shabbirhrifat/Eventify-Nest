import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.method === 'POST' && !request.headers['idempotency-key']) {
      throw new BadRequestException(
        'Idempotency-Key header is required for this operation.',
      );
    }

    return true;
  }
}
