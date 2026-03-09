import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  const globalPrefix = configService.get<string>('app.globalPrefix') ?? 'api';
  const port = configService.get<number>('app.port') ?? 3000;
  const uploadsRootPath =
    configService.get<string>('app.uploadsRootPath') ?? 'uploads';
  const uploadsDirectory = join(process.cwd(), uploadsRootPath);

  mkdirSync(uploadsDirectory, { recursive: true });

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
  app.useStaticAssets(uploadsDirectory, { prefix: '/uploads' });
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(
    `Application is running on http://localhost:${port}/${globalPrefix}`,
  );
}

void bootstrap();
