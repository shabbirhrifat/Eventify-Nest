import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './cache/redis.module';
import { CategoriesModule } from './categories/categories.module';
import { SanitizeBodyInterceptor } from './common/interceptors/sanitize-body.interceptor';
import { RolesGuard } from './common/guards/roles.guard';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.validation';
import { mailConfig } from './config/mail.config';
import { queuesConfig } from './config/queues.config';
import { redisConfig } from './config/redis.config';
import { securityConfig } from './config/security.config';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        redisConfig,
        mailConfig,
        securityConfig,
        queuesConfig,
      ],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.getOrThrow<string>('database.host'),
        port: configService.getOrThrow<number>('database.port'),
        username: configService.getOrThrow<string>('database.username'),
        password: configService.getOrThrow<string>('database.password'),
        database: configService.getOrThrow<string>('database.database'),
        synchronize: configService.getOrThrow<boolean>('database.synchronize'),
        logging: configService.get<boolean>('database.logging') ?? false,
        autoLoadEntities: true,
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host') ?? '127.0.0.1',
          port: configService.get<number>('redis.port') ?? 6379,
          password: configService.get<string>('redis.password') || undefined,
          db: configService.get<number>('redis.db') ?? 0,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
      {
        name: 'public',
        ttl: 60_000,
        limit: 60,
      },
      {
        name: 'auth',
        ttl: 15 * 60_000,
        limit: 5,
      },
    ]),
    RedisModule,
    HealthModule,
    AuditLogsModule,
    SettingsModule,
    UsersModule,
    CategoriesModule,
    EventsModule,
    IdempotencyModule,
    NotificationsModule,
    RegistrationsModule,
    AuthModule,
    AdminModule,
  ],
  providers: [
    RolesGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SanitizeBodyInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
