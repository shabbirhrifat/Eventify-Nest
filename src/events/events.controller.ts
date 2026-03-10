import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccountStatusGuard } from '../common/guards/account-status.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import {
  createImageFileValidationPipe,
  createImageUploadOptions,
} from '../common/utils/file-upload.util';
import { CreateEventDto } from './dto/create-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

const eventImageUploadOptions = createImageUploadOptions('events');
const eventImageValidationPipe = createImageFileValidationPipe(8 * 1024 * 1024);

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Get()
  findAll(@Query() query: EventQueryDto) {
    return this.eventsService.findAll(query);
  }

  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.eventsService.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, AccountStatusGuard, RolesGuard)
  @Roles(UserRole.Organizer, UserRole.Admin)
  @Post()
  create(
    @CurrentUserId() organizerId: string,
    @Body() createEventDto: CreateEventDto,
  ) {
    return this.eventsService.create(organizerId, createEventDto);
  }

  @UseGuards(JwtAuthGuard, AccountStatusGuard, RolesGuard)
  @Roles(UserRole.Organizer, UserRole.Admin)
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file', eventImageUploadOptions))
  uploadImage(
    @Param('id', new ParseUUIDPipe()) eventId: string,
    @CurrentUserId() actorUserId: string,
    @UploadedFile(eventImageValidationPipe)
    file: Express.Multer.File,
  ) {
    return this.eventsService.uploadEventImage(
      eventId,
      file.filename,
      actorUserId,
    );
  }

  @UseGuards(JwtAuthGuard, AccountStatusGuard, RolesGuard)
  @Roles(UserRole.Organizer, UserRole.Admin)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) eventId: string,
    @CurrentUserId() actorUserId: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(eventId, actorUserId, updateEventDto);
  }

  @UseGuards(JwtAuthGuard, AccountStatusGuard, RolesGuard)
  @Roles(UserRole.Organizer, UserRole.Admin)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) eventId: string,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.eventsService.remove(eventId, actorUserId);
  }

  @UseGuards(JwtAuthGuard, AccountStatusGuard, RolesGuard)
  @Roles(UserRole.Organizer, UserRole.Admin)
  @Get(':id/registrations')
  getRegistrations(
    @Param('id', new ParseUUIDPipe()) eventId: string,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.eventsService.getOrganizerRegistrations(eventId, actorUserId);
  }

  @UseGuards(JwtAuthGuard, AccountStatusGuard, RolesGuard)
  @Roles(UserRole.Organizer, UserRole.Admin)
  @Post(':id/export')
  exportRegistrations(
    @Param('id', new ParseUUIDPipe()) eventId: string,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.eventsService.exportRegistrations(eventId, actorUserId);
  }
}
