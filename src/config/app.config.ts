import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'competition-registration-system',
  port: Number(process.env.PORT ?? 3000),
  globalPrefix: process.env.GLOBAL_PREFIX ?? 'api',
  uploadsRootPath: process.env.UPLOADS_ROOT_PATH ?? 'uploads',
}));
