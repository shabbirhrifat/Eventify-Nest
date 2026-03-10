import request from 'supertest';
import { UserRole } from '../src/common/enums/user-role.enum';
import {
  TEST_IDS,
  authHeaders,
  createEndpointTestApp,
} from './utils/endpoint-test-app';

describe('Categories endpoints (e2e)', () => {
  it('covers public listing and admin mutations', async () => {
    const { app, mocks } = await createEndpointTestApp();

    await request(app.getHttpServer())
      .get('/api/categories')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].slug).toBe('technology');
      });

    await request(app.getHttpServer())
      .post('/api/categories')
      .send({ name: 'Tech' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/categories')
      .set(authHeaders({ role: UserRole.Admin, userId: TEST_IDS.admin }))
      .send({ name: 'Business' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.name).toBe('Business');
      });

    await request(app.getHttpServer())
      .patch(`/api/categories/${TEST_IDS.category}`)
      .set(authHeaders({ role: UserRole.Admin, userId: TEST_IDS.admin }))
      .send({ name: 'Updated Category' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(TEST_IDS.category);
      });

    await request(app.getHttpServer())
      .delete(`/api/categories/${TEST_IDS.category}`)
      .set(authHeaders({ role: UserRole.Admin, userId: TEST_IDS.admin }))
      .expect(200)
      .expect(({ body }) => {
        expect(body.message).toBe('Category deleted successfully.');
      });

    expect(mocks.categoriesService.findAll).toHaveBeenCalledTimes(1);
    expect(mocks.categoriesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Business' }),
    );
    expect(mocks.categoriesService.update).toHaveBeenCalledWith(
      TEST_IDS.category,
      expect.objectContaining({ name: 'Updated Category' }),
    );
    expect(mocks.categoriesService.remove).toHaveBeenCalledWith(
      TEST_IDS.category,
    );

    await app.close();
  });
});
