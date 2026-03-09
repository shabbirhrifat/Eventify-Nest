import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async ping() {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      return await this.redis.ping();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Redis ping failed: ${message}`);
      throw error;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      const rawValue = await this.redis.get(key);
      return rawValue ? (JSON.parse(rawValue) as T) : null;
    } catch {
      this.logger.warn(`Redis get failed for ${key}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number) {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      const serializedValue = JSON.stringify(value);

      if (ttlSeconds) {
        await this.redis.set(key, serializedValue, 'EX', ttlSeconds);
        return;
      }

      await this.redis.set(key, serializedValue);
    } catch {
      this.logger.warn(`Redis set failed for ${key}`);
    }
  }

  async delete(key: string) {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      await this.redis.del(key);
    } catch {
      this.logger.warn(`Redis delete failed for ${key}`);
    }
  }

  async deleteByPattern(pattern: string) {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      } while (cursor !== '0');
    } catch {
      this.logger.warn(`Redis delete by pattern failed for ${pattern}`);
    }
  }

  async onModuleDestroy() {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }
}
