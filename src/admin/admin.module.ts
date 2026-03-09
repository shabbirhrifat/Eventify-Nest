import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Event } from '../events/entities/event.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { RegistrationsModule } from '../registrations/registrations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    UsersModule,
    RegistrationsModule,
    SettingsModule,
    NotificationsModule,
    TypeOrmModule.forFeature([Event, Registration, AuditLog]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
