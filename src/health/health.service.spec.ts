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
});
