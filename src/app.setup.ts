import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SanitizeBodyInterceptor } from './common/interceptors/sanitize-body.interceptor';

export interface ConfigureHttpAppOptions {
  enableShutdownHooks?: boolean;
  ensureUploadsDirectory?: boolean;
}

export function configureHttpApp(
  app: NestExpressApplication,
  configService: ConfigService,
  options: ConfigureHttpAppOptions = {},
) {
  const { enableShutdownHooks = true, ensureUploadsDirectory = true } = options;
  const globalPrefix = configService.get<string>('app.globalPrefix') ?? 'api';
  const uploadsRootPath =
    configService.get<string>('app.uploadsRootPath') ?? 'uploads';
  const uploadsDirectory = join(process.cwd(), uploadsRootPath);

  if (ensureUploadsDirectory) {
    mkdirSync(uploadsDirectory, { recursive: true });
  }

  app.setGlobalPrefix(globalPrefix);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new SanitizeBodyInterceptor());
  app.useStaticAssets(uploadsDirectory, { prefix: '/uploads' });

  if (enableShutdownHooks) {
    app.enableShutdownHooks();
  }

  return {
    globalPrefix,
    uploadsDirectory,
  };
}
