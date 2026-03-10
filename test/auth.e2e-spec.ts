import request from 'supertest';
import { UserRole } from '../src/common/enums/user-role.enum';
import {
  TEST_IDS,
  authHeaders,
  createEndpointTestApp,
} from './utils/endpoint-test-app';

describe('Auth endpoints (e2e)', () => {
  it('covers register, login, refresh, logout, verify email, and me', async () => {
    const { app, mocks } = await createEndpointTestApp();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'NEW.USER@Example.com',
        password: 'Password123',
        fullName: 'New User',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.verificationRequired).toBe(true);
        expect(body.user.email).toBe('new.user@example.com');
      });

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'not-an-email',
        password: 'short',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toEqual(
          expect.arrayContaining([
            expect.stringContaining('email must be an email'),
          ]),
        );
      });

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set(authHeaders({ userId: TEST_IDS.participant }))
      .send({
        email: 'participant@example.com',
        password: 'Password123',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.accessToken).toBe('access-token');
        expect(body.user.id).toBe(TEST_IDS.participant);
      });

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'refresh-token' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.accessToken).toBe('new-access-token');
      });

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: 'refresh-token' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.message).toBe('Logged out successfully.');
      });

    await request(app.getHttpServer())
      .get('/api/auth/verify-email/email-token-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(TEST_IDS.participant);
      });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(
        authHeaders({
          userId: TEST_IDS.admin,
          role: UserRole.Admin,
        }),
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(TEST_IDS.admin);
      });

    await request(app.getHttpServer()).get('/api/auth/me').expect(401);

    expect(mocks.authService.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new.user@example.com',
      }),
    );
    expect(mocks.authService.login).toHaveBeenCalledWith(TEST_IDS.participant);
    expect(mocks.authService.refreshTokens).toHaveBeenCalledWith({
      refreshToken: 'refresh-token',
    });
    expect(mocks.authService.logout).toHaveBeenCalledWith({
      refreshToken: 'refresh-token',
    });
    expect(mocks.authService.verifyEmail).toHaveBeenCalledWith('email-token-1');
    expect(mocks.authService.getCurrentUser).toHaveBeenCalledWith(
      TEST_IDS.admin,
    );

    await app.close();
  });
});
