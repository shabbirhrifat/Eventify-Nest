import { ConfigService } from '@nestjs/config';
import {
  HealthCheckService,
  HealthIndicatorService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { RedisService } from '../cache/redis.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns liveness payload', () => {
    const service = new HealthService(
      {
        get: jest.fn().mockReturnValue('competition-registration-system'),
      } as unknown as ConfigService,
      {} as HealthCheckService,
      {} as TypeOrmHealthIndicator,
      {} as HealthIndicatorService,
      {} as RedisService,
    );

    const result = service.getLiveness();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('competition-registration-system');
    expect(result.timestamp).toEqual(expect.any(String));
  });

  it('runs readiness checks for the database and redis', async () => {
    const pingCheck = jest.fn().mockResolvedValue({
      database: { status: 'up' },
    });
    const redisUp = jest.fn().mockReturnValue({ redis: { status: 'up' } });
    const healthCheck = jest.fn().mockImplementation(async (checks) => {
      const info = Object.assign(
        {},
        ...(await Promise.all(checks.map((check) => check()))),
      );

      return {
        status: 'ok',
        info,
      };
    });
    const redisPing = jest.fn().mockResolvedValue('PONG');
    const service = new HealthService(
      {
        get: jest.fn(),
      } as unknown as ConfigService,
      {
        check: healthCheck,
      } as unknown as HealthCheckService,
      {
        pingCheck,
      } as unknown as TypeOrmHealthIndicator,
      {
        check: jest.fn().mockReturnValue({ up: redisUp }),
      } as unknown as HealthIndicatorService,
      {
        ping: redisPing,
      } as unknown as RedisService,
    );

    const result = await service.readiness();

    expect(pingCheck).toHaveBeenCalledWith('database');
    expect(redisPing).toHaveBeenCalled();
    expect(redisUp).toHaveBeenCalled();
    expect(result).toEqual({
      status: 'ok',
      info: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });
});
