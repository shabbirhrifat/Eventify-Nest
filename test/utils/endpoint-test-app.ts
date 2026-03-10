import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { AdminController } from '../../src/admin/admin.controller';
import { AdminService } from '../../src/admin/admin.service';
import { configureHttpApp } from '../../src/app.setup';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { LocalAuthGuard } from '../../src/auth/guards/local-auth.guard';
import { CategoriesController } from '../../src/categories/categories.controller';
import { CategoriesService } from '../../src/categories/categories.service';
import { AccountStatusGuard } from '../../src/common/guards/account-status.guard';
import { IdempotencyGuard } from '../../src/common/guards/idempotency.guard';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { EventStatus } from '../../src/common/enums/event-status.enum';
import { NotificationType } from '../../src/common/enums/notification-type.enum';
import { PaymentStatus } from '../../src/common/enums/payment-status.enum';
import { RegistrationStatus } from '../../src/common/enums/registration-status.enum';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { UserStatus } from '../../src/common/enums/user-status.enum';
import type { JwtUser } from '../../src/common/interfaces/jwt-user.interface';
import { EventsController } from '../../src/events/events.controller';
import { EventsService } from '../../src/events/events.service';
import { HealthController } from '../../src/health/health.controller';
import { HealthService } from '../../src/health/health.service';
import { RegistrationsController } from '../../src/registrations/registrations.controller';
import { RegistrationsService } from '../../src/registrations/registrations.service';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';

export const TEST_IDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  organizer: '22222222-2222-4222-8222-222222222222',
  participant: '33333333-3333-4333-8333-333333333333',
  suspendedUser: '44444444-4444-4444-8444-444444444444',
  event: '55555555-5555-4555-8555-555555555555',
  eventSecondary: '66666666-6666-4666-8666-666666666666',
  registration: '77777777-7777-4777-8777-777777777777',
  category: '88888888-8888-4888-8888-888888888888',
  user: '99999999-9999-4999-8999-999999999999',
} as const;

type TestJwtRequest = Request & {
  user?: JwtUser;
  header(name: string): string | undefined;
};

@Injectable()
class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TestJwtRequest>();
    const authorization = request.header('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    request.user = {
      sub: request.header('x-test-user-id') ?? TEST_IDS.participant,
      email: request.header('x-test-email') ?? 'participant@example.com',
      role:
        (request.header('x-test-role') as UserRole | undefined) ??
        UserRole.Participant,
      status:
        (request.header('x-test-status') as UserStatus | undefined) ??
        UserStatus.Active,
    };

    return true;
  }
}

@Injectable()
class TestLocalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<TestJwtRequest & { user?: { id: string } }>();

    request.user = {
      id: request.header('x-test-user-id') ?? TEST_IDS.participant,
    } as never;

    return true;
  }
}

function buildUser(
  userId: string = TEST_IDS.participant,
  role: UserRole = UserRole.Participant,
) {
  return {
    id: userId,
    email: `${userId}@example.com`,
    role,
    status: UserStatus.Active,
    emailVerified: true,
    createdAt: '2026-03-10T10:00:00.000Z',
    profile: {
      id: `profile-${userId}`,
      fullName: 'Test User',
      phone: null,
      city: 'Dhaka',
      organization: 'Eventify',
      bio: null,
      avatarUrl: null,
    },
  };
}

function buildEvent(eventId: string = TEST_IDS.event) {
  return {
    id: eventId,
    title: 'NestConf 2026',
    slug: 'nestconf-2026',
    description: 'An end-to-end tested event.',
    startDate: '2026-05-10T10:00:00.000Z',
    endDate: '2026-05-10T18:00:00.000Z',
    registrationDeadline: '2026-05-01T23:59:59.000Z',
    location: 'Dhaka',
    maxAttendees: 250,
    currentRegistrations: 12,
    status: EventStatus.Published,
    price: '0',
    priceOptions: null,
    imageUrl: null,
    metadata: null,
    cancellationPolicy: null,
    categories: [
      {
        id: TEST_IDS.category,
        name: 'Technology',
        slug: 'technology',
      },
    ],
    organizer: {
      id: TEST_IDS.organizer,
      email: 'organizer@example.com',
      fullName: 'Organizer User',
    },
    isFull: false,
    registrationOpen: true,
    isRegistered: false,
  };
}

function buildRegistration(registrationId: string = TEST_IDS.registration) {
  return {
    id: registrationId,
    registrationNumber: 'EVT555555-1234567890-001',
    status: RegistrationStatus.Confirmed,
    paymentStatus: PaymentStatus.Paid,
    paymentAmount: '0.00',
    paymentMethod: null,
    selectedPriceOption: null,
    checkInTime: null,
    cancellationDate: null,
    qrCodeDataUrl: 'data:image/png;base64,qr',
    waitlistPromotedAt: null,
    waitlistOfferExpiresAt: null,
    event: {
      id: TEST_IDS.event,
      title: 'NestConf 2026',
      slug: 'nestconf-2026',
      startDate: '2026-05-10T10:00:00.000Z',
      endDate: '2026-05-10T18:00:00.000Z',
      location: 'Dhaka',
    },
    user: {
      id: TEST_IDS.participant,
      email: 'participant@example.com',
      fullName: 'Participant User',
    },
    createdAt: '2026-03-10T10:00:00.000Z',
  };
}

function buildCategory() {
  return {
    id: TEST_IDS.category,
    name: 'Technology',
    slug: 'technology',
    parent: null,
    children: [],
  };
}

function buildMocks() {
  const healthService = {
    getLiveness: jest.fn().mockReturnValue({
      status: 'ok',
      service: 'eventify-test',
      timestamp: '2026-03-10T10:00:00.000Z',
      uptimeInSeconds: 42,
    }),
    readiness: jest.fn().mockResolvedValue({
      status: 'ok',
      info: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    }),
  };

  const authService = {
    register: jest.fn().mockImplementation(async (dto: { email: string }) => ({
      user: {
        ...buildUser(TEST_IDS.participant),
        email: dto.email,
      },
      verificationRequired: true,
    })),
    login: jest.fn().mockImplementation(async (userId: string) => ({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
      user: buildUser(userId),
    })),
    refreshTokens: jest.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      tokenType: 'Bearer',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
      user: buildUser(),
    }),
    logout: jest.fn().mockResolvedValue({
      message: 'Logged out successfully.',
    }),
    verifyEmail: jest.fn().mockResolvedValue(buildUser()),
    getCurrentUser: jest
      .fn()
      .mockImplementation(async (userId: string) => buildUser(userId)),
  };

  const categoriesService = {
    findAll: jest.fn().mockResolvedValue([buildCategory()]),
    create: jest.fn().mockImplementation(async (dto: { name: string }) => ({
      ...buildCategory(),
      name: dto.name,
      slug: dto.name.toLowerCase(),
    })),
    update: jest
      .fn()
      .mockImplementation(async (id: string, dto: { name?: string }) => ({
        ...buildCategory(),
        id,
        name: dto.name ?? 'Updated Category',
        slug: (dto.name ?? 'updated-category').toLowerCase(),
      })),
    remove: jest.fn().mockResolvedValue({
      message: 'Category deleted successfully.',
    }),
  };

  const eventsService = {
    findAll: jest
      .fn()
      .mockImplementation(async (query: { page?: number; limit?: number }) => ({
        items: [buildEvent()],
        total: 1,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        totalPages: 1,
      })),
    findBySlug: jest.fn().mockResolvedValue(buildEvent()),
    create: jest.fn().mockImplementation(async (organizerId: string) => ({
      ...buildEvent(),
      organizer: {
        id: organizerId,
        email: 'organizer@example.com',
        fullName: 'Organizer User',
      },
    })),
    uploadEventImage: jest
      .fn()
      .mockImplementation(async (eventId: string, fileName: string) => ({
        ...buildEvent(eventId),
        imageUrl: `/uploads/events/${fileName}`,
      })),
    update: jest
      .fn()
      .mockImplementation(async (eventId: string) => buildEvent(eventId)),
    remove: jest.fn().mockResolvedValue({
      message: 'Event deleted successfully.',
    }),
    getOrganizerRegistrations: jest
      .fn()
      .mockResolvedValue([buildRegistration()]),
    exportRegistrations: jest.fn().mockResolvedValue({
      fileName: `event-${TEST_IDS.event}-registrations.csv`,
      content:
        'registrationNumber,email\nEVT555555-1234567890-001,participant@example.com\n',
    }),
  };

  const registrationsService = {
    createRegistration: jest.fn().mockResolvedValue(buildRegistration()),
    listMyRegistrations: jest.fn().mockResolvedValue([buildRegistration()]),
    cancelRegistration: jest.fn().mockResolvedValue({
      message: 'Registration cancelled successfully.',
    }),
    claimWaitlistOffer: jest.fn().mockResolvedValue({
      ...buildRegistration(),
      status: RegistrationStatus.Pending,
    }),
    checkIn: jest.fn().mockResolvedValue({
      ...buildRegistration(),
      status: RegistrationStatus.Attended,
      checkInTime: '2026-03-10T11:00:00.000Z',
    }),
  };

  const usersService = {
    getProfile: jest
      .fn()
      .mockImplementation(async (userId: string) => buildUser(userId)),
    updateProfile: jest
      .fn()
      .mockImplementation(
        async (userId: string, dto: { fullName?: string }) => ({
          ...buildUser(userId),
          profile: {
            ...buildUser(userId).profile,
            fullName: dto.fullName ?? 'Updated User',
          },
        }),
      ),
    changePassword: jest.fn().mockResolvedValue({
      message: 'Password updated successfully.',
    }),
    updateAvatar: jest
      .fn()
      .mockImplementation(async (userId: string, fileName: string) => ({
        ...buildUser(userId),
        profile: {
          ...buildUser(userId).profile,
          avatarUrl: `/uploads/avatars/${fileName}`,
        },
      })),
    deleteAccount: jest.fn().mockResolvedValue({
      message: 'Account deleted successfully.',
    }),
  };

  const adminService = {
    getDashboard: jest.fn().mockResolvedValue({
      totals: {
        users: 10,
        events: 3,
        registrations: 15,
      },
      charts: {
        registrationsByStatus: [
          {
            status: RegistrationStatus.Confirmed,
            count: 10,
          },
        ],
        registrationsByMonth: [
          {
            month: '2026-03',
            count: 15,
          },
        ],
      },
      recentRegistrations: [
        {
          id: TEST_IDS.registration,
          registrationNumber: 'EVT555555-1234567890-001',
          status: RegistrationStatus.Confirmed,
          event: 'NestConf 2026',
          user: 'Participant User',
          createdAt: '2026-03-10T10:00:00.000Z',
        },
      ],
      recentActivity: [],
    }),
    listUsers: jest
      .fn()
      .mockImplementation(async (query: { page?: number; limit?: number }) => ({
        items: [buildUser()],
        total: 1,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        totalPages: 1,
      })),
    changeUserRole: jest
      .fn()
      .mockImplementation(
        async (
          _actorUserId: string,
          userId: string,
          dto: { role: UserRole },
        ) => ({
          ...buildUser(userId, dto.role),
        }),
      ),
    updateUserStatus: jest
      .fn()
      .mockImplementation(
        async (
          _actorUserId: string,
          userId: string,
          dto: { status: UserStatus },
        ) => ({
          ...buildUser(userId),
          status: dto.status,
        }),
      ),
    listRegistrations: jest
      .fn()
      .mockImplementation(async (query: { page?: number; limit?: number }) => ({
        items: [buildRegistration()],
        total: 1,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        totalPages: 1,
      })),
    exportRegistrations: jest.fn().mockResolvedValue({
      fileName: `registrations-${TEST_IDS.event}.csv`,
      content:
        'registrationNumber,email\nEVT555555-1234567890-001,participant@example.com\n',
    }),
    updateSettings: jest
      .fn()
      .mockImplementation(async (dto: { items: unknown[] }) => ({
        items: dto.items,
      })),
    getSettings: jest.fn().mockResolvedValue([
      {
        key: 'registration',
        value: { enabled: true },
        description: 'Registration settings',
      },
    ]),
    listNotificationTemplates: jest.fn().mockResolvedValue([
      {
        type: NotificationType.RegistrationConfirmation,
        subjectTemplate: 'Registration confirmed',
        enabled: true,
      },
    ]),
    updateNotificationTemplate: jest
      .fn()
      .mockImplementation(
        async (type: NotificationType, dto: Record<string, unknown>) => ({
          type,
          ...dto,
        }),
      ),
  };

  return {
    healthService,
    authService,
    categoriesService,
    eventsService,
    registrationsService,
    usersService,
    adminService,
  };
}

export type EndpointTestMocks = ReturnType<typeof buildMocks>;

export async function createEndpointTestApp(): Promise<{
  app: NestExpressApplication;
  mocks: EndpointTestMocks;
}> {
  const mocks = buildMocks();
  const moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            app: {
              name: 'eventify-test',
              globalPrefix: 'api',
              uploadsRootPath: process.env.UPLOADS_ROOT_PATH ?? '.test-uploads',
            },
          }),
        ],
      }),
    ],
    controllers: [
      HealthController,
      AuthController,
      CategoriesController,
      EventsController,
      RegistrationsController,
      UsersController,
      AdminController,
    ],
    providers: [
      Reflector,
      AccountStatusGuard,
      IdempotencyGuard,
      RolesGuard,
      {
        provide: JwtAuthGuard,
        useClass: TestJwtAuthGuard,
      },
      {
        provide: LocalAuthGuard,
        useClass: TestLocalAuthGuard,
      },
      {
        provide: HealthService,
        useValue: mocks.healthService,
      },
      {
        provide: AuthService,
        useValue: mocks.authService,
      },
      {
        provide: CategoriesService,
        useValue: mocks.categoriesService,
      },
      {
        provide: EventsService,
        useValue: mocks.eventsService,
      },
      {
        provide: RegistrationsService,
        useValue: mocks.registrationsService,
      },
      {
        provide: UsersService,
        useValue: mocks.usersService,
      },
      {
        provide: AdminService,
        useValue: mocks.adminService,
      },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useClass(TestJwtAuthGuard)
    .overrideGuard(LocalAuthGuard)
    .useClass(TestLocalAuthGuard);

  const moduleRef = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  const configService = app.get(ConfigService);

  configureHttpApp(app, configService, {
    enableShutdownHooks: false,
  });

  await app.init();

  return {
    app,
    mocks,
  };
}

export function authHeaders(
  options: {
    role?: UserRole;
    status?: UserStatus;
    userId?: string;
    email?: string;
  } = {},
) {
  return {
    authorization: 'Bearer test-token',
    'x-test-user-id': options.userId ?? TEST_IDS.participant,
    'x-test-role': options.role ?? UserRole.Participant,
    'x-test-status': options.status ?? UserStatus.Active,
    'x-test-email': options.email ?? 'participant@example.com',
  };
}
