import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueName } from '../common/enums/queue-name.enum';
import { Event } from '../events/entities/event.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsScheduler } from './notifications.scheduler';
import { EmailProcessor } from './processors/email.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationTemplate,
      NotificationDelivery,
      Event,
      Registration,
    ]),
    BullModule.registerQueue({ name: QueueName.Email }),
  ],
  providers: [NotificationsService, NotificationsScheduler, EmailProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
