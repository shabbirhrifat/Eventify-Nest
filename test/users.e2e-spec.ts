import { join } from 'node:path';
import request from 'supertest';
import { UserStatus } from '../src/common/enums/user-status.enum';
import {
  TEST_IDS,
  authHeaders,
  createEndpointTestApp,
} from './utils/endpoint-test-app';

describe('Users endpoints (e2e)', () => {
  it('covers profile, password, avatar, and delete endpoints', async () => {
    const { app, mocks } = await createEndpointTestApp();

    await request(app.getHttpServer())
      .get('/api/users/profile')
      .set(authHeaders({ userId: TEST_IDS.participant }))
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(TEST_IDS.participant);
      });

    await request(app.getHttpServer())
      .patch('/api/users/profile')
      .set(authHeaders({ userId: TEST_IDS.participant }))
      .send({ fullName: '<b>Updated</b> User' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.profile.fullName).toBe('bUpdated/b User');
      });

    await request(app.getHttpServer())
      .patch('/api/users/password')
      .set(authHeaders({ userId: TEST_IDS.participant }))
      .send({
        currentPassword: 'Password123',
        newPassword: 'UpdatedPass123',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.message).toBe('Password updated successfully.');
      });

    await request(app.getHttpServer())
      .post('/api/users/avatar')
      .set(authHeaders({ userId: TEST_IDS.participant }))
      .attach('file', join(process.cwd(), 'test/fixtures/sample.png'), {
        filename: 'sample.png',
        contentType: 'image/png',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.profile.avatarUrl).toContain('/uploads/avatars/');
      });

    await request(app.getHttpServer())
      .delete('/api/users/account')
      .set(authHeaders({ userId: TEST_IDS.participant }))
      .expect(200)
      .expect(({ body }) => {
        expect(body.message).toBe('Account deleted successfully.');
      });

    await request(app.getHttpServer())
      .get('/api/users/profile')
      .set(
        authHeaders({
          userId: TEST_IDS.suspendedUser,
          status: UserStatus.Suspended,
        }),
      )
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe('Your account is suspended.');
      });

    expect(mocks.usersService.getProfile).toHaveBeenCalledWith(
      TEST_IDS.participant,
    );
    expect(mocks.usersService.updateProfile).toHaveBeenCalledWith(
      TEST_IDS.participant,
      expect.objectContaining({ fullName: 'bUpdated/b User' }),
    );
    expect(mocks.usersService.changePassword).toHaveBeenCalledWith(
      TEST_IDS.participant,
      expect.objectContaining({
        currentPassword: 'Password123',
        newPassword: 'UpdatedPass123',
      }),
    );
    expect(mocks.usersService.updateAvatar).toHaveBeenCalledWith(
      TEST_IDS.participant,
      expect.stringMatching(/\.png$/),
    );
    expect(mocks.usersService.deleteAccount).toHaveBeenCalledWith(
      TEST_IDS.participant,
    );

    await app.close();
  });
});
