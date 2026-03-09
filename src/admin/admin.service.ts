import { stringify } from 'csv-stringify/sync';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Event } from '../events/entities/event.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { Registration } from '../registrations/entities/registration.entity';
import { RegistrationQueryDto } from '../registrations/dto/registration-query.dto';
import { RegistrationsService } from '../registrations/registrations.service';
import { SettingsService } from '../settings/settings.service';
import { UpdateSettingsDto } from '../settings/dto/update-settings.dto';
import { UsersService } from '../users/users.service';
import { AssignRoleDto } from '../users/dto/assign-role.dto';
import { UpdateUserStatusDto } from '../users/dto/update-user-status.dto';
import { UserQueryDto } from '../users/dto/user-query.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly registrationsService: RegistrationsService,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Registration)
    private readonly registrationRepository: Repository<Registration>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async getDashboard() {
    const [
      totalUsers,
      totalEvents,
      totalRegistrations,
      recentRegistrations,
      recentAuditLogs,
    ] = await Promise.all([
      this.usersService.listUsers({ page: 1, limit: 1 }),
      this.eventRepository.count(),
      this.registrationRepository.count(),
      this.registrationRepository.find({
        relations: { event: true, user: { profile: true } },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.auditLogRepository.find({
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    const registrationsByStatusRaw = await this.registrationRepository
      .createQueryBuilder('registration')
      .select('registration.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('registration.status')
      .getRawMany<{ status: string; count: string }>();

    const registrationsByMonthRaw = await this.registrationRepository
      .createQueryBuilder('registration')
      .select("TO_CHAR(registration.createdAt, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(registration.createdAt, 'YYYY-MM')")
      .orderBy('month', 'ASC')
      .getRawMany<{ month: string; count: string }>();

    return {
      totals: {
        users: totalUsers.total,
        events: totalEvents,
        registrations: totalRegistrations,
      },
      charts: {
        registrationsByStatus: registrationsByStatusRaw.map((item) => ({
          status: item.status,
          count: Number(item.count),
        })),
        registrationsByMonth: registrationsByMonthRaw.map((item) => ({
          month: item.month,
          count: Number(item.count),
        })),
      },
      recentRegistrations: recentRegistrations.map((registration) => ({
        id: registration.id,
        registrationNumber: registration.registrationNumber,
        status: registration.status,
        event: registration.event.title,
        user: registration.user.profile.fullName,
        createdAt: registration.createdAt,
      })),
      recentActivity: recentAuditLogs,
    };
  }

  listUsers(query: UserQueryDto) {
    return this.usersService.listUsers(query);
  }

  changeUserRole(actorUserId: string, userId: string, dto: AssignRoleDto) {
    return this.usersService.assignRole(actorUserId, userId, dto);
  }

  updateUserStatus(
    actorUserId: string,
    userId: string,
    dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(actorUserId, userId, dto);
  }

  listRegistrations(query: RegistrationQueryDto) {
    return this.registrationsService.adminList(query);
  }

  updateSettings(dto: UpdateSettingsDto) {
    return this.settingsService.updateMany(dto);
  }

  listNotificationTemplates() {
    return this.notificationsService.getTemplates();
  }

  updateNotificationTemplate(
    type: NotificationType,
    dto: import('../notifications/dto/update-notification-template.dto').UpdateNotificationTemplateDto,
  ) {
    return this.notificationsService.updateTemplate(type, dto);
  }

  getSettings() {
    return this.settingsService.getAll();
  }

  async exportRegistrations(eventId: string) {
    const rows =
      await this.registrationsService.exportEventRegistrations(eventId);
    return {
      fileName: `registrations-${eventId}.csv`,
      content: stringify(rows, { header: true }),
    };
  }
}
