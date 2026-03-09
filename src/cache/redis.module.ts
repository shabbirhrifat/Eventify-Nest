import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Redis({
          host: configService.get<string>('redis.host') ?? '127.0.0.1',
          port: configService.get<number>('redis.port') ?? 6379,
          password: configService.get<string>('redis.password') || undefined,
          db: configService.get<number>('redis.db') ?? 0,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
        }),
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
