import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureHttpApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;
  const { globalPrefix } = configureHttpApp(app, configService);

  await app.listen(port);

  logger.log(
    `Application is running on http://localhost:${port}/${globalPrefix}`,
  );
}

void bootstrap();
