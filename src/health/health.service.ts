import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisService } from '../cache/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly healthCheckService: HealthCheckService,
    private readonly typeOrmHealthIndicator: TypeOrmHealthIndicator,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redisService: RedisService,
  ) {}

  getLiveness() {
    return {
      status: 'ok',
      service:
        this.configService.get<string>('app.name') ??
        'competition-registration-system',
      timestamp: new Date().toISOString(),
      uptimeInSeconds: Math.round(process.uptime()),
    };
  }

  readiness() {
    return this.healthCheckService.check([
      async () => this.typeOrmHealthIndicator.pingCheck('database'),
      async () => {
        await this.redisService.ping();
        return this.healthIndicatorService.check('redis').up();
      },
    ]);
  }
}
