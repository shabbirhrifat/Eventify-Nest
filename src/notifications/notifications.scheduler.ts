import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { NotificationType } from '../common/enums/notification-type.enum';
import { RegistrationStatus } from '../common/enums/registration-status.enum';
import { Event } from '../events/entities/event.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsScheduler {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Registration)
    private readonly registrationRepository: Repository<Registration>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendEventReminders() {
    const windowStart = new Date(Date.now() + 23 * 60 * 60 * 1000);
    const windowEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const events = await this.eventRepository.find({
      where: {
        startDate: Between(windowStart, windowEnd),
      },
      relations: { registrations: { user: { profile: true } } },
    });

    for (const event of events) {
      const registrations = await this.registrationRepository.find({
        where: {
          event: { id: event.id },
          status: RegistrationStatus.Confirmed,
        },
        relations: { user: { profile: true } },
      });

      for (const registration of registrations) {
        await this.notificationsService.queueNotification(
          NotificationType.EventReminder,
          registration.user.email,
          {
            name: registration.user.profile.fullName,
            eventName: event.title,
            startDate: event.startDate.toISOString(),
          },
        );
      }
    }
  }
}
