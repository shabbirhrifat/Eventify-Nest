import { registerAs } from '@nestjs/config';

export const queuesConfig = registerAs('queues', () => ({
  emailAttempts: Number(process.env.EMAIL_QUEUE_ATTEMPTS ?? 3),
  registrationAttempts: Number(process.env.REGISTRATION_QUEUE_ATTEMPTS ?? 5),
}));
