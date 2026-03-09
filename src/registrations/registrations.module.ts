import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EventsModule } from '../events/events.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { Event } from '../events/entities/event.entity';
import { Registration } from './entities/registration.entity';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsScheduler } from './registrations.scheduler';
import { RegistrationsService } from './registrations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Registration, Event, User]),
    NotificationsModule,
    AuditLogsModule,
    IdempotencyModule,
    EventsModule,
  ],
  controllers: [RegistrationsController],
  providers: [RegistrationsService, RegistrationsScheduler],
  exports: [RegistrationsService, TypeOrmModule],
})
export class RegistrationsModule {}
