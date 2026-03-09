import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { UserRole } from '../common/enums/user-role.enum';
import { RegisterUserDto } from '../users/dto/register-user.dto';
import { UsersService } from '../users/users.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import type { AuthTokens } from './interfaces/auth-tokens.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(registerUserDto: RegisterUserDto) {
    const user = await this.usersService.createUser(registerUserDto);

    return {
      user,
      verificationRequired: !user.emailVerified,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user) {
      await this.auditLogsService.record('auth.login_failed', 'user', null, {
        email,
      });
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      await this.auditLogsService.record('auth.login_failed', 'user', user.id, {
        email: user.email,
      });
      return null;
    }

    if (!user.emailVerified && user.role !== UserRole.Admin) {
      throw new ForbiddenException(
        'Email verification is required before participant access.',
      );
    }

    return this.usersService.getProfile(user.id);
  }

  async login(userId: string): Promise<AuthTokens> {
    const user = await this.usersService.getProfile(userId);
    const payload: JwtUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
    const accessTokenExpiresIn =
      this.configService.get<string>('security.accessTokenExpiresIn') ?? '15m';
    const refreshTokenExpiresIn =
      this.configService.get<string>('security.refreshTokenExpiresIn') ?? '7d';
    const tokenId = randomUUID();

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('auth.secret'),
      expiresIn: accessTokenExpiresIn as StringValue,
    });

    const refreshPayload: JwtUser = {
      ...payload,
      tokenId,
    };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      expiresIn: refreshTokenExpiresIn as StringValue,
    });

    const hashedToken = await bcrypt.hash(refreshToken, 10);

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        tokenId,
        hashedToken,
        user: { id: user.id } as never,
        expiresAt: new Date(
          Date.now() + this.convertDurationToMs(refreshTokenExpiresIn),
        ),
      }),
    );

    await this.auditLogsService.record('auth.login_succeeded', 'user', user.id);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessTokenExpiresIn,
      refreshExpiresIn: refreshTokenExpiresIn,
      user,
    };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);
    await this.revokeRefreshToken(payload.tokenId ?? '');
    return this.login(payload.sub);
  }

  async logout(refreshTokenDto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);
    await this.revokeRefreshToken(payload.tokenId ?? '');
    return { message: 'Logged out successfully.' };
  }

  async verifyEmail(token: string) {
    return this.usersService.verifyEmail(token);
  }

  async getCurrentUser(userId: string) {
    return this.usersService.getProfile(userId);
  }

  private async verifyRefreshToken(refreshToken: string) {
    let payload: JwtUser;

    try {
      payload = await this.jwtService.verifyAsync<JwtUser>(refreshToken, {
        secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    const storedToken = await this.refreshTokenRepository
      .createQueryBuilder('refreshToken')
      .addSelect('refreshToken.hashedToken')
      .leftJoinAndSelect('refreshToken.user', 'user')
      .where('refreshToken.tokenId = :tokenId', { tokenId: payload.tokenId })
      .getOne();

    if (
      !storedToken ||
      storedToken.revoked ||
      storedToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    const matches = await bcrypt.compare(refreshToken, storedToken.hashedToken);

    if (!matches) {
      throw new UnauthorizedException('Refresh token validation failed.');
    }

    return payload;
  }

  private async revokeRefreshToken(tokenId: string) {
    await this.refreshTokenRepository.update({ tokenId }, { revoked: true });
  }

  private convertDurationToMs(duration: string) {
    const match = duration.match(/^(\d+)([smhd])$/);

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const value = Number(match[1]);
    const unit = match[2];

    const factor =
      unit === 's'
        ? 1000
        : unit === 'm'
          ? 60000
          : unit === 'h'
            ? 3600000
            : 86400000;
    return value * factor;
  }
}
