import { NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Event } from '../events/entities/event.entity';
import { User } from '../users/entities/user.entity';
import { Registration } from './entities/registration.entity';
import { RegistrationsService } from './registrations.service';

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  let registrationRepository: jest.Mocked<Repository<Registration>>;

  beforeEach(() => {
    registrationRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<Registration>>;

    service = new RegistrationsService(
      { transaction: jest.fn() } as unknown as DataSource,
      registrationRepository,
      {} as Repository<Event>,
      {} as Repository<User>,
      { queueNotification: jest.fn() } as unknown as NotificationsService,
      { record: jest.fn() } as unknown as AuditLogsService,
      {
        reserveOrReplay: jest.fn(),
        createRequestHash: jest.fn(),
        complete: jest.fn(),
      } as unknown as IdempotencyService,
    );
  });

  it('throws when cancelling an unknown registration', async () => {
    registrationRepository.findOne.mockResolvedValue(null);

    await expect(
      service.cancelRegistration('user-1', 'registration-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replays a stored idempotent registration response', async () => {
    const idempotencyService = {
      reserveOrReplay: jest.fn().mockResolvedValue({
        type: 'replay',
        record: {
          id: 'idem-1',
          responseBody: { id: 'registration-1', status: 'confirmed' },
        },
      }),
      createRequestHash: jest.fn().mockReturnValue('hash'),
      complete: jest.fn(),
    } as unknown as IdempotencyService;

    service = new RegistrationsService(
      { transaction: jest.fn() } as unknown as DataSource,
      registrationRepository,
      {} as Repository<Event>,
      {} as Repository<User>,
      { queueNotification: jest.fn() } as unknown as NotificationsService,
      { record: jest.fn() } as unknown as AuditLogsService,
      idempotencyService,
    );

    await expect(
      service.createRegistration('user-1', 'event-1', {}, 'idem-key'),
    ).resolves.toEqual({ id: 'registration-1', status: 'confirmed' });
  });
});
