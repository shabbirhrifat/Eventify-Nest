import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CategoriesModule } from '../categories/categories.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Registration } from '../registrations/entities/registration.entity';
import { User } from '../users/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { Event } from './entities/event.entity';
import { EventsController } from './events.controller';
import { EventsScheduler } from './events.scheduler';
import { EventsService } from './events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Category, User, Registration]),
    CategoriesModule,
    AuditLogsModule,
    NotificationsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, EventsScheduler],
  exports: [EventsService, TypeOrmModule],
})
export class EventsModule {}
