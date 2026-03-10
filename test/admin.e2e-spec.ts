import request from 'supertest';
import { NotificationType } from '../src/common/enums/notification-type.enum';
import { UserRole } from '../src/common/enums/user-role.enum';
import { UserStatus } from '../src/common/enums/user-status.enum';
import {
  TEST_IDS,
  authHeaders,
  createEndpointTestApp,
} from './utils/endpoint-test-app';

describe('Admin endpoints (e2e)', () => {
  it('covers all admin routes and validation', async () => {
    const { app, mocks } = await createEndpointTestApp();
    const adminAuth = authHeaders({
      role: UserRole.Admin,
      userId: TEST_IDS.admin,
    });

    await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .set(adminAuth)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totals.users).toBe(10);
      });

    await request(app.getHttpServer())
      .get('/api/admin/users?page=3&limit=2&search=user')
      .set(adminAuth)
      .expect(200)
      .expect(({ body }) => {
        expect(body.page).toBe(3);
        expect(body.limit).toBe(2);
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${TEST_IDS.user}/role`)
      .set(adminAuth)
      .send({ role: UserRole.Organizer })
      .expect(200)
      .expect(({ body }) => {
        expect(body.role).toBe(UserRole.Organizer);
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${TEST_IDS.user}/status`)
      .set(adminAuth)
      .send({ status: UserStatus.Suspended })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(UserStatus.Suspended);
      });

    await request(app.getHttpServer())
      .get('/api/admin/registrations?page=1&limit=5')
      .set(adminAuth)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .post(`/api/admin/events/${TEST_IDS.event}/export`)
      .set(adminAuth)
      .expect(201)
      .expect(({ body }) => {
        expect(body.fileName).toContain(TEST_IDS.event);
      });

    await request(app.getHttpServer())
      .put('/api/admin/settings')
      .set(adminAuth)
      .send({
        items: [
          {
            key: 'registration',
            value: { enabled: true },
            description: 'Controls registration state',
          },
        ],
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .get('/api/admin/settings')
      .set(adminAuth)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .get('/api/admin/notification-templates')
      .set(adminAuth)
      .expect(200)
      .expect(({ body }) => {
        expect(body[0].type).toBe(NotificationType.RegistrationConfirmation);
      });

    await request(app.getHttpServer())
      .patch(
        `/api/admin/notification-templates/${NotificationType.EventChanged}`,
      )
      .set(adminAuth)
      .send({ enabled: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body.type).toBe(NotificationType.EventChanged);
        expect(body.enabled).toBe(false);
      });

    await request(app.getHttpServer())
      .patch('/api/admin/notification-templates/invalid')
      .set(adminAuth)
      .send({ enabled: false })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe(
          'Validation failed (enum string is expected)',
        );
      });

    expect(mocks.adminService.getDashboard).toHaveBeenCalledTimes(1);
    expect(mocks.adminService.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, limit: 2, search: 'user' }),
    );
    expect(mocks.adminService.changeUserRole).toHaveBeenCalledWith(
      TEST_IDS.admin,
      TEST_IDS.user,
      expect.objectContaining({ role: UserRole.Organizer }),
    );
    expect(mocks.adminService.updateUserStatus).toHaveBeenCalledWith(
      TEST_IDS.admin,
      TEST_IDS.user,
      expect.objectContaining({ status: UserStatus.Suspended }),
    );
    expect(mocks.adminService.listRegistrations).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 5 }),
    );
    expect(mocks.adminService.exportRegistrations).toHaveBeenCalledWith(
      TEST_IDS.event,
    );
    expect(mocks.adminService.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ key: 'registration' })],
      }),
    );
    expect(mocks.adminService.getSettings).toHaveBeenCalledTimes(1);
    expect(mocks.adminService.listNotificationTemplates).toHaveBeenCalledTimes(
      1,
    );
    expect(mocks.adminService.updateNotificationTemplate).toHaveBeenCalledWith(
      NotificationType.EventChanged,
      expect.objectContaining({ enabled: false }),
    );

    await app.close();
  });
});
