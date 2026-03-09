import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  liveness() {
    return this.healthService.getLiveness();
  }

  @Public()
  @Get('ready')
  readiness() {
    return this.healthService.readiness();
  }
}
