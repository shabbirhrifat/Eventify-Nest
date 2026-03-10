import request from 'supertest';
import { createEndpointTestApp } from './utils/endpoint-test-app';

describe('Health endpoints (e2e)', () => {
  it('covers liveness and readiness endpoints', async () => {
    const { app, mocks } = await createEndpointTestApp();

    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.service).toBe('eventify-test');
      });

    await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.info.database.status).toBe('up');
        expect(body.info.redis.status).toBe('up');
      });

    expect(mocks.healthService.getLiveness).toHaveBeenCalledTimes(1);
    expect(mocks.healthService.readiness).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
