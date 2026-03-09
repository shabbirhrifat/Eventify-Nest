import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let auditLogsService: jest.Mocked<AuditLogsService>;
  let refreshTokenRepository: jest.Mocked<Repository<RefreshToken>>;
  let saveSpy: jest.Mock;
  let auditSpy: jest.Mock;

  beforeEach(() => {
    usersService = {
      createUser: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      getProfile: jest.fn(),
      verifyEmail: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token'),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'security.accessTokenExpiresIn') return '15m';
        if (key === 'security.refreshTokenExpiresIn') return '7d';
        return undefined;
      }),
      getOrThrow: jest.fn().mockImplementation((key: string) => `${key}-value`),
    } as unknown as jest.Mocked<ConfigService>;

    auditSpy = jest.fn();

    auditLogsService = {
      record: auditSpy,
    } as unknown as jest.Mocked<AuditLogsService>;

    saveSpy = jest.fn();

    refreshTokenRepository = {
      create: jest.fn((value) => value as RefreshToken),
      save: saveSpy,
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<RefreshToken>>;

    service = new AuthService(
      usersService,
      jwtService,
      configService,
      auditLogsService,
      refreshTokenRepository,
    );
  });

  it('issues access and refresh tokens on login', async () => {
    usersService.getProfile.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.Participant,
      status: UserStatus.Active,
      emailVerified: true,
      createdAt: new Date(),
      profile: {
        id: 'profile-1',
        fullName: 'User Example',
        phone: null,
        city: null,
        organization: null,
        bio: null,
        avatarUrl: null,
      },
    });

    const result = await service.login('user-1');
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(saveSpy).toHaveBeenCalled();
    expect(auditSpy).toHaveBeenCalledWith(
      'auth.login_succeeded',
      'user',
      'user-1',
    );
  });

  it('rejects unverified non-admin users during credential validation', async () => {
    const hashedPassword = await bcrypt.hash('Password123', 10);

    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      password: hashedPassword,
      role: UserRole.Participant,
      status: UserStatus.Active,
      emailVerified: false,
      emailVerifiedAt: null,
      emailVerificationToken: 'token',
      profile: {
        id: 'profile-1',
        fullName: 'User Example',
        phone: null,
        city: null,
        organization: null,
        bio: null,
        avatarUrl: null,
      },
    } as never);

    await expect(
      service.validateUser('user@example.com', 'Password123'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
