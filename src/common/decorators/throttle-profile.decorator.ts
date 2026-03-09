import { applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

export function AuthThrottle() {
  return applyDecorators(Throttle({ auth: { limit: 5, ttl: 15 * 60 * 1000 } }));
}

export function PublicApiThrottle() {
  return applyDecorators(Throttle({ public: { limit: 60, ttl: 60 * 1000 } }));
}
