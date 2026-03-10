import { join } from 'node:path';
import request from 'supertest';
import { UserRole } from '../src/common/enums/user-role.enum';
import {
  TEST_IDS,
  authHeaders,
  createEndpointTestApp,
} from './utils/endpoint-test-app';

describe('Events endpoints (e2e)', () => {
  it('covers public queries and organizer mutations', async () => {
    const { app, mocks } = await createEndpointTestApp();

    await request(app.getHttpServer())
      .get('/api/events?page=2&limit=5&search=nest')
      .expect(200)
      .expect(({ body }) => {
        expect(body.page).toBe(2);
        expect(body.limit).toBe(5);
        expect(body.items[0].slug).toBe('nestconf-2026');
      });

    await request(app.getHttpServer())
      .get('/api/events/invalid-slug')
      .expect(200)
      .expect(({ body }) => {
        expect(body.slug).toBe('nestconf-2026');
      });

    const createPayload = {
      title: 'Conference 2026',
      description: '<b>Great</b> event for everyone.',
      startDate: '2026-06-01T10:00:00.000Z',
      endDate: '2026-06-01T18:00:00.000Z',
      registrationDeadline: '2026-05-20T23:59:59.000Z',
      location: 'Dhaka',
      categoryIds: [TEST_IDS.category],
    };

    await request(app.getHttpServer())
      .post('/api/events')
      .set(
        authHeaders({
          role: UserRole.Organizer,
          userId: TEST_IDS.organizer,
          email: 'organizer@example.com',
        }),
      )
      .send(createPayload)
      .expect(201)
      .expect(({ body }) => {
        expect(body.organizer.id).toBe(TEST_IDS.organizer);
      });

    await request(app.getHttpServer())
      .post('/api/events')
      .set(
        authHeaders({ role: UserRole.Organizer, userId: TEST_IDS.organizer }),
      )
      .send({ title: 'x' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/events/${TEST_IDS.event}/image`)
      .set(
        authHeaders({ role: UserRole.Organizer, userId: TEST_IDS.organizer }),
      )
      .attach('file', join(process.cwd(), 'test/fixtures/sample.png'), {
        filename: 'sample.png',
        contentType: 'image/png',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.imageUrl).toContain('/uploads/events/');
      });

    await request(app.getHttpServer())
      .patch(`/api/events/${TEST_IDS.event}`)
      .set(
        authHeaders({ role: UserRole.Organizer, userId: TEST_IDS.organizer }),
      )
      .send({ title: 'Updated Conference' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(TEST_IDS.event);
      });

    await request(app.getHttpServer())
      .delete(`/api/events/${TEST_IDS.event}`)
      .set(
        authHeaders({ role: UserRole.Organizer, userId: TEST_IDS.organizer }),
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body.message).toBe('Event deleted successfully.');
      });

    await request(app.getHttpServer())
      .get(`/api/events/${TEST_IDS.event}/registrations`)
      .set(
        authHeaders({ role: UserRole.Organizer, userId: TEST_IDS.organizer }),
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .post(`/api/events/${TEST_IDS.event}/export`)
      .set(
        authHeaders({ role: UserRole.Organizer, userId: TEST_IDS.organizer }),
      )
      .expect(201)
      .expect(({ body }) => {
        expect(body.fileName).toContain(TEST_IDS.event);
      });

    expect(mocks.eventsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, search: 'nest' }),
    );
    expect(mocks.eventsService.findBySlug).toHaveBeenCalledWith('invalid-slug');
    expect(mocks.eventsService.create).toHaveBeenCalledWith(
      TEST_IDS.organizer,
      expect.objectContaining({
        description: 'bGreat/b event for everyone.',
      }),
    );
    expect(mocks.eventsService.uploadEventImage).toHaveBeenCalledWith(
      TEST_IDS.event,
      expect.stringMatching(/\.png$/),
      TEST_IDS.organizer,
    );
    expect(mocks.eventsService.update).toHaveBeenCalledWith(
      TEST_IDS.event,
      TEST_IDS.organizer,
      expect.objectContaining({ title: 'Updated Conference' }),
    );
    expect(mocks.eventsService.remove).toHaveBeenCalledWith(
      TEST_IDS.event,
      TEST_IDS.organizer,
    );
    expect(mocks.eventsService.getOrganizerRegistrations).toHaveBeenCalledWith(
      TEST_IDS.event,
      TEST_IDS.organizer,
    );
    expect(mocks.eventsService.exportRegistrations).toHaveBeenCalledWith(
      TEST_IDS.event,
      TEST_IDS.organizer,
    );

    await app.close();
  });
});
