import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  secret:
    process.env.JWT_SECRET ??
    'change-this-to-a-long-random-secret-with-at-least-32-characters',
  refreshSecret:
    process.env.JWT_REFRESH_SECRET ??
    'change-this-refresh-secret-to-a-long-random-secret-too',
}));
