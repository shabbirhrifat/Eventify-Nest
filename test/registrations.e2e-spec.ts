import request from 'supertest';
import { UserRole } from '../src/common/enums/user-role.enum';
import {
  TEST_IDS,
  authHeaders,
  createEndpointTestApp,
} from './utils/endpoint-test-app';

describe('Registrations endpoints (e2e)', () => {
  it('covers registration lifecycle endpoints', async () => {
    const { app, mocks } = await createEndpointTestApp();

    await request(app.getHttpServer())
      .post(`/api/events/${TEST_IDS.event}/register`)
      .set(authHeaders({ userId: TEST_IDS.participant }))
      .set('idempotency-key', 'idem-1')
      .send({
        paymentMethod: 'card',
        metadata: { source: 'web' },
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.id).toBe(TEST_IDS.registration);
      });

    await request(app.getHttpServer())
      .post(`/api/events/${TEST_IDS.event}/register`)
      .set(authHeaders({ userId: TEST_IDS.participant }))
      .send({ paymentMethod: 'card' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe(
          'Idempotency-Key header is required for this operation.',
        );
      });

    await request(app.getHttpServer())
      .get('/api/users/registrations')
      .set(authHeaders({ userId: TEST_IDS.participant }))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .delete(`/api/registrations/${TEST_IDS.registration}`)
      .set(authHeaders({ userId: TEST_IDS.participant }))
      .expect(200)
      .expect(({ body }) => {
        expect(body.message).toBe('Registration cancelled successfully.');
      });

    await request(app.getHttpServer())
      .post(`/api/registrations/${TEST_IDS.registration}/claim`)
      .set(authHeaders({ userId: TEST_IDS.participant }))
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('pending');
      });

    await request(app.getHttpServer())
      .post(
        `/api/events/${TEST_IDS.event}/registrations/${TEST_IDS.registration}/check-in`,
      )
      .set(
        authHeaders({ role: UserRole.Organizer, userId: TEST_IDS.organizer }),
      )
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('attended');
      });

    expect(mocks.registrationsService.createRegistration).toHaveBeenCalledWith(
      TEST_IDS.participant,
      TEST_IDS.event,
      expect.objectContaining({ paymentMethod: 'card' }),
      'idem-1',
    );
    expect(mocks.registrationsService.listMyRegistrations).toHaveBeenCalledWith(
      TEST_IDS.participant,
    );
    expect(mocks.registrationsService.cancelRegistration).toHaveBeenCalledWith(
      TEST_IDS.participant,
      TEST_IDS.registration,
    );
    expect(mocks.registrationsService.claimWaitlistOffer).toHaveBeenCalledWith(
      TEST_IDS.participant,
      TEST_IDS.registration,
    );
    expect(mocks.registrationsService.checkIn).toHaveBeenCalledWith(
      TEST_IDS.organizer,
      TEST_IDS.event,
      TEST_IDS.registration,
    );

    await app.close();
  });
});
