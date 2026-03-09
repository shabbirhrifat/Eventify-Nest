import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AccountStatusGuard } from '../common/guards/account-status.guard';
import { IdempotencyGuard } from '../common/guards/idempotency.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationsService } from './registrations.service';

@Controller()
@UseGuards(JwtAuthGuard, AccountStatusGuard)
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @UseGuards(IdempotencyGuard)
  @Post('events/:eventId/register')
  registerForEvent(
    @CurrentUserId() userId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body() createRegistrationDto: CreateRegistrationDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.registrationsService.createRegistration(
      userId,
      eventId,
      createRegistrationDto,
      idempotencyKey,
    );
  }

  @Get('users/registrations')
  listMyRegistrations(@CurrentUserId() userId: string) {
    return this.registrationsService.listMyRegistrations(userId);
  }

  @Delete('registrations/:id')
  cancelRegistration(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) registrationId: string,
  ) {
    return this.registrationsService.cancelRegistration(userId, registrationId);
  }

  @Post('registrations/:id/claim')
  claimWaitlistOffer(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) registrationId: string,
  ) {
    return this.registrationsService.claimWaitlistOffer(userId, registrationId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.Organizer, UserRole.Admin)
  @Post('events/:eventId/registrations/:id/check-in')
  checkIn(
    @CurrentUserId() actorUserId: string,
    @Param('id', new ParseUUIDPipe()) registrationId: string,
  ) {
    return this.registrationsService.checkIn(actorUserId, registrationId);
  }
}
