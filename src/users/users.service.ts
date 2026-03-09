import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { FindOptionsWhere, ILike, Not, Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  createPaginatedResponse,
  getPagination,
} from '../common/utils/pagination.util';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { Profile } from './entities/profile.entity';
import { User } from './entities/user.entity';
import { UserResponse } from './interfaces/user-response.interface';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async createUser(registerUserDto: RegisterUserDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerUserDto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const totalUsers = await this.userRepository.count();
    const password = await bcrypt.hash(registerUserDto.password, 12);
    const role = totalUsers === 0 ? UserRole.Admin : UserRole.Participant;

    const profile = this.profileRepository.create({
      fullName: registerUserDto.fullName,
      phone: registerUserDto.phone ?? null,
      city: registerUserDto.city ?? null,
      organization: registerUserDto.organization ?? null,
      bio: null,
      avatarUrl: null,
    });

    const user = this.userRepository.create({
      email: registerUserDto.email,
      password,
      role,
      emailVerified: totalUsers === 0,
      emailVerificationToken: totalUsers === 0 ? null : randomUUID(),
      emailVerifiedAt: totalUsers === 0 ? new Date() : null,
      profile,
    });

    const savedUser = await this.userRepository.save(user);

    await this.auditLogsService.record(
      'user.registered',
      'user',
      savedUser.id,
      {
        email: savedUser.email,
        role: savedUser.role,
      },
    );

    return this.toUserResponse(savedUser);
  }

  async findByEmailWithPassword(email: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('user.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  async findById(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    return this.toUserResponse(user);
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.findById(userId);

    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateProfileDto.email.toLowerCase(), id: Not(userId) },
      });

      if (existingUser) {
        throw new ConflictException('Another user already uses that email.');
      }

      user.email = updateProfileDto.email.toLowerCase();
      user.emailVerified = false;
      user.emailVerifiedAt = null;
      user.emailVerificationToken = randomUUID();
    }

    if (updateProfileDto.fullName) {
      user.profile.fullName = updateProfileDto.fullName;
    }

    if (updateProfileDto.phone !== undefined) {
      user.profile.phone = updateProfileDto.phone ?? null;
    }

    if (updateProfileDto.city !== undefined) {
      user.profile.city = updateProfileDto.city ?? null;
    }

    if (updateProfileDto.organization !== undefined) {
      user.profile.organization = updateProfileDto.organization ?? null;
    }

    const savedUser = await this.userRepository.save(user);
    await this.auditLogsService.record('user.profile_updated', 'user', userId);
    return this.toUserResponse(savedUser);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const currentPasswordMatches = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!currentPasswordMatches) {
      throw new ForbiddenException('Current password is invalid.');
    }

    user.password = await bcrypt.hash(changePasswordDto.newPassword, 12);
    await this.userRepository.save(user);

    await this.auditLogsService.record('user.password_changed', 'user', userId);
    return { message: 'Password updated successfully.' };
  }

  async verifyEmail(token: string) {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
      relations: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('Verification token is invalid.');
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationToken = null;
    const savedUser = await this.userRepository.save(user);

    await this.auditLogsService.record('user.email_verified', 'user', user.id);
    return this.toUserResponse(savedUser);
  }

  async updateAvatar(userId: string, storedFileName: string) {
    const user = await this.findById(userId);

    if (user.profile.avatarUrl) {
      await this.deleteAvatarFile(user.profile.avatarUrl);
    }

    user.profile.avatarUrl = `/uploads/avatars/${storedFileName}`;
    const savedUser = await this.userRepository.save(user);
    return this.toUserResponse(savedUser);
  }

  async listUsers(query: UserQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where: FindOptionsWhere<User> = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.email) {
      where.email = query.email.toLowerCase();
    }

    const [items, total] = query.search
      ? await this.userRepository.findAndCount({
          where: [
            { ...where, email: ILike(`%${query.search}%`) },
            { ...where, profile: { fullName: ILike(`%${query.search}%`) } },
          ],
          relations: { profile: true },
          skip,
          take: limit,
          order: { createdAt: 'DESC' },
        })
      : await this.userRepository.findAndCount({
          where,
          relations: { profile: true },
          skip,
          take: limit,
          order: { createdAt: 'DESC' },
        });

    return createPaginatedResponse(
      items.map((item) => this.toUserResponse(item)),
      total,
      page,
      limit,
    );
  }

  async assignRole(actorUserId: string, userId: string, dto: AssignRoleDto) {
    const user = await this.findById(userId);

    if (user.role === UserRole.Admin && dto.role !== UserRole.Admin) {
      const adminCount = await this.userRepository.count({
        where: { role: UserRole.Admin },
      });

      if (adminCount <= 1) {
        throw new BadRequestException(
          'At least one admin must remain in the system.',
        );
      }
    }

    user.role = dto.role;
    const savedUser = await this.userRepository.save(user);
    await this.auditLogsService.record(
      'user.role_updated',
      'user',
      actorUserId,
      {
        targetUserId: userId,
        role: dto.role,
      },
    );
    return this.toUserResponse(savedUser);
  }

  async updateStatus(
    actorUserId: string,
    userId: string,
    dto: UpdateUserStatusDto,
  ) {
    const user = await this.findById(userId);
    user.status = dto.status;
    const savedUser = await this.userRepository.save(user);
    await this.auditLogsService.record(
      'user.status_updated',
      'user',
      actorUserId,
      {
        targetUserId: userId,
        status: dto.status,
      },
    );
    return this.toUserResponse(savedUser);
  }

  async deleteAccount(userId: string) {
    const user = await this.findById(userId);
    await this.userRepository.remove(user);
    await this.auditLogsService.record('user.deleted', 'user', userId);
    return { message: 'Account deleted successfully.' };
  }

  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      profile: {
        id: user.profile.id,
        fullName: user.profile.fullName,
        phone: user.profile.phone,
        city: user.profile.city,
        organization: user.profile.organization,
        bio: user.profile.bio,
        avatarUrl: user.profile.avatarUrl,
      },
    };
  }

  private async deleteAvatarFile(avatarUrl: string) {
    if (!avatarUrl.startsWith('/uploads/')) {
      return;
    }

    const uploadsRootPath = process.env.UPLOADS_ROOT_PATH ?? 'uploads';
    const relativePath = avatarUrl.replace('/uploads/', '');
    const absolutePath = join(process.cwd(), uploadsRootPath, relativePath);

    try {
      await unlink(absolutePath);
    } catch {
      this.logger.warn(`Unable to remove avatar file: ${absolutePath}`);
    }
  }
}
