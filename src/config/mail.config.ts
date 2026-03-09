import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? 1025),
  user: process.env.SMTP_USER ?? '',
  password: process.env.SMTP_PASSWORD ?? '',
  fromName: process.env.SMTP_FROM_NAME ?? 'NestJS Blueprint',
  fromEmail: process.env.SMTP_FROM_EMAIL ?? 'no-reply@example.com',
}));
