import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccountStatusGuard } from '../common/guards/account-status.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificationType } from '../common/enums/notification-type.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { UpdateNotificationTemplateDto } from '../notifications/dto/update-notification-template.dto';
import { RegistrationQueryDto } from '../registrations/dto/registration-query.dto';
import { UpdateSettingsDto } from '../settings/dto/update-settings.dto';
import { AssignRoleDto } from '../users/dto/assign-role.dto';
import { UpdateUserStatusDto } from '../users/dto/update-user-status.dto';
import { UserQueryDto } from '../users/dto/user-query.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AccountStatusGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  listUsers(@Query() query: UserQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/role')
  changeUserRole(
    @CurrentUserId() actorUserId: string,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() assignRoleDto: AssignRoleDto,
  ) {
    return this.adminService.changeUserRole(actorUserId, userId, assignRoleDto);
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @CurrentUserId() actorUserId: string,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() updateUserStatusDto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(
      actorUserId,
      userId,
      updateUserStatusDto,
    );
  }

  @Get('registrations')
  listRegistrations(@Query() query: RegistrationQueryDto) {
    return this.adminService.listRegistrations(query);
  }

  @Post('events/:id/export')
  exportRegistrations(@Param('id', new ParseUUIDPipe()) eventId: string) {
    return this.adminService.exportRegistrations(eventId);
  }

  @Put('settings')
  updateSettings(@Body() updateSettingsDto: UpdateSettingsDto) {
    return this.adminService.updateSettings(updateSettingsDto);
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getSettings();
  }

  @Get('notification-templates')
  listNotificationTemplates() {
    return this.adminService.listNotificationTemplates();
  }

  @Patch('notification-templates/:type')
  updateNotificationTemplate(
    @Param('type') type: NotificationType,
    @Body() updateNotificationTemplateDto: UpdateNotificationTemplateDto,
  ) {
    return this.adminService.updateNotificationTemplate(
      type,
      updateNotificationTemplateDto,
    );
  }
}
