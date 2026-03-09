import { registerAs } from '@nestjs/config';

export const securityConfig = registerAs('security', () => ({
  accessTokenExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  idempotencyTtlHours: Number(process.env.IDEMPOTENCY_TTL_HOURS ?? 24),
}));
