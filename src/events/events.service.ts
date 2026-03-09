import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RedisService } from '../cache/redis.service';
import { UserRole } from '../common/enums/user-role.enum';
import {
  createPaginatedResponse,
  getPagination,
} from '../common/utils/pagination.util';
import { slugify } from '../common/utils/slug.util';
import { stringify } from 'csv-stringify/sync';
import { Category } from '../categories/entities/category.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { Registration } from '../registrations/entities/registration.entity';
import { User } from '../users/entities/user.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './entities/event.entity';
import { EventStatus } from '../common/enums/event-status.enum';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Registration)
    private readonly registrationRepository: Repository<Registration>,
    private readonly auditLogsService: AuditLogsService,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(organizerId: string, dto: CreateEventDto) {
    this.validateEventDates(dto);

    const organizer = await this.userRepository.findOne({
      where: { id: organizerId },
      relations: { profile: true },
    });

    if (!organizer) {
      throw new NotFoundException('Organizer not found.');
    }

    const categories = dto.categoryIds?.length
      ? await this.categoryRepository.find({
          where: { id: In(dto.categoryIds) },
        })
      : [];
    const slug = await this.createUniqueSlug(dto.title);

    const event = this.eventRepository.create({
      title: dto.title,
      description: dto.description,
      slug,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      registrationDeadline: new Date(dto.registrationDeadline),
      location: dto.location,
      maxAttendees: dto.maxAttendees ?? 0,
      currentRegistrations: 0,
      status: dto.status ?? EventStatus.Draft,
      price: String(dto.price ?? 0),
      priceOptions: dto.priceOptions
        ? (dto.priceOptions as unknown as Array<Record<string, unknown>>)
        : null,
      imageUrl: null,
      metadata: dto.metadata ?? null,
      cancellationPolicy: dto.cancellationPolicy ?? null,
      organizer,
      categories,
    });

    const savedEvent = await this.eventRepository.save(event);
    await this.invalidateEventCaches();
    await this.auditLogsService.record('event.created', 'event', organizerId, {
      eventId: savedEvent.id,
      title: savedEvent.title,
    });

    return this.findById(savedEvent.id);
  }

  async uploadEventImage(
    eventId: string,
    imageFileName: string,
    actorUserId: string,
  ) {
    const event = await this.findEventForMutation(eventId, actorUserId);
    event.imageUrl = `/uploads/events/${imageFileName}`;
    await this.eventRepository.save(event);
    await this.invalidateEventCaches();
    return this.findById(event.id);
  }

  async findAll(query: EventQueryDto, currentUserId?: string | null) {
    const cacheKey = `events:list:${JSON.stringify({ ...query, currentUserId })}`;
    const cached =
      await this.redisService.getJson<
        ReturnType<typeof createPaginatedResponse>
      >(cacheKey);

    if (cached) {
      return cached;
    }

    const { page, limit, skip } = getPagination(query);
    const qb = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.categories', 'categories')
      .leftJoinAndSelect('event.organizer', 'organizer')
      .leftJoinAndSelect('organizer.profile', 'organizerProfile');

    if (query.status) {
      qb.andWhere('event.status = :status', { status: query.status });
    } else {
      qb.andWhere('event.status != :draftStatus', {
        draftStatus: EventStatus.Draft,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(event.title ILIKE :search OR event.description ILIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    if (query.startDateFrom) {
      qb.andWhere('event.startDate >= :startDateFrom', {
        startDateFrom: query.startDateFrom,
      });
    }

    if (query.startDateTo) {
      qb.andWhere('event.startDate <= :startDateTo', {
        startDateTo: query.startDateTo,
      });
    }

    if (query.categorySlug) {
      qb.andWhere('categories.slug = :categorySlug', {
        categorySlug: query.categorySlug,
      });
    }

    const sortBy = query.sortBy ?? 'startDate';
    const sortOrder = query.sortOrder ?? 'ASC';

    if (sortBy === 'popularity' || sortBy === 'registrationCount') {
      qb.orderBy('event.currentRegistrations', sortOrder);
    } else {
      qb.orderBy('event.startDate', sortOrder);
    }

    qb.skip(skip).take(limit);

    const [events, total] = await qb.getManyAndCount();
    const registrationEventIds = currentUserId
      ? (
          await this.registrationRepository.find({
            where: { user: { id: currentUserId } },
            relations: { event: true },
          })
        ).map((registration) => registration.event.id)
      : [];

    const response = createPaginatedResponse(
      events.map((event) => this.toEventResponse(event, registrationEventIds)),
      total,
      page,
      limit,
    );

    await this.redisService.setJson(cacheKey, response, 60);
    return response;
  }

  async findBySlug(slug: string, currentUserId?: string | null) {
    const event = await this.eventRepository.findOne({
      where: { slug },
      relations: { categories: true, organizer: { profile: true } },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    const registration = currentUserId
      ? await this.registrationRepository.findOne({
          where: { event: { id: event.id }, user: { id: currentUserId } },
        })
      : null;

    return this.toEventResponse(event, registration ? [event.id] : []);
  }

  async findById(id: string) {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: { categories: true, organizer: { profile: true } },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    return this.toEventResponse(event);
  }

  async update(eventId: string, actorUserId: string, dto: UpdateEventDto) {
    const event = await this.findEventForMutation(eventId, actorUserId);

    if (dto.startDate || dto.endDate || dto.registrationDeadline) {
      this.validateEventDates({
        ...event,
        ...dto,
        startDate: dto.startDate ?? event.startDate.toISOString(),
        endDate: dto.endDate ?? event.endDate.toISOString(),
        registrationDeadline:
          dto.registrationDeadline ?? event.registrationDeadline.toISOString(),
      } as CreateEventDto);
    }

    if (dto.title && dto.title !== event.title) {
      event.title = dto.title;
      event.slug = await this.createUniqueSlug(dto.title, event.id);
    }

    if (dto.description !== undefined) {
      event.description = dto.description;
    }

    if (dto.startDate) {
      event.startDate = new Date(dto.startDate);
    }

    if (dto.endDate) {
      event.endDate = new Date(dto.endDate);
    }

    if (dto.registrationDeadline) {
      event.registrationDeadline = new Date(dto.registrationDeadline);
    }

    if (dto.location !== undefined) {
      event.location = dto.location;
    }

    if (dto.maxAttendees !== undefined) {
      if (
        dto.maxAttendees > 0 &&
        dto.maxAttendees < event.currentRegistrations
      ) {
        throw new BadRequestException(
          'maxAttendees cannot be lower than current registrations.',
        );
      }

      event.maxAttendees = dto.maxAttendees;
    }

    if (dto.status) {
      event.status = dto.status;
    }

    if (dto.price !== undefined) {
      event.price = String(dto.price);
    }

    if (dto.priceOptions !== undefined) {
      event.priceOptions = dto.priceOptions as unknown as Array<
        Record<string, unknown>
      >;
    }

    if (dto.metadata !== undefined) {
      event.metadata = dto.metadata;
    }

    if (dto.cancellationPolicy !== undefined) {
      event.cancellationPolicy = dto.cancellationPolicy;
    }

    if (dto.categoryIds) {
      event.categories = dto.categoryIds.length
        ? await this.categoryRepository.find({
            where: { id: In(dto.categoryIds) },
          })
        : [];
    }

    const savedEvent = await this.eventRepository.save(event);
    await this.invalidateEventCaches();
    await this.auditLogsService.record('event.updated', 'event', actorUserId, {
      eventId,
    });

    if (savedEvent.status !== EventStatus.Draft) {
      await this.notifyParticipants(
        savedEvent.id,
        NotificationType.EventChanged,
        {
          eventName: savedEvent.title,
        },
      );
    }

    return this.findById(savedEvent.id);
  }

  async remove(eventId: string, actorUserId: string) {
    const event = await this.findEventForMutation(eventId, actorUserId);
    const registrationCount = await this.registrationRepository.count({
      where: { event: { id: event.id } },
    });

    if (registrationCount > 0) {
      throw new BadRequestException(
        'Events with registrations cannot be deleted. Cancel the event instead.',
      );
    }

    await this.eventRepository.remove(event);
    await this.invalidateEventCaches();
    await this.auditLogsService.record('event.deleted', 'event', actorUserId, {
      eventId,
    });
    return { message: 'Event deleted successfully.' };
  }

  async findEventForMutation(eventId: string, actorUserId: string) {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: { organizer: true, categories: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    const actor = await this.userRepository.findOne({
      where: { id: actorUserId },
    });

    if (!actor) {
      throw new NotFoundException('Actor not found.');
    }

    if (actor.role !== UserRole.Admin && event.organizer.id !== actorUserId) {
      throw new ForbiddenException('You can only manage your own events.');
    }

    return event;
  }

  async invalidateEventCaches() {
    await this.redisService.deleteByPattern('events:*');
    await this.redisService.delete('categories:list');
  }

  async getOrganizerRegistrations(eventId: string, actorUserId: string) {
    await this.findEventForMutation(eventId, actorUserId);

    return this.registrationRepository.find({
      where: { event: { id: eventId } },
      relations: { user: { profile: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async exportRegistrations(eventId: string, actorUserId: string) {
    const registrations = await this.getOrganizerRegistrations(
      eventId,
      actorUserId,
    );

    return {
      fileName: `event-${eventId}-registrations.csv`,
      content: stringify(
        registrations.map((registration) => ({
          registrationNumber: registration.registrationNumber,
          email: registration.user.email,
          fullName: registration.user.profile.fullName,
          status: registration.status,
          paymentStatus: registration.paymentStatus,
          createdAt: registration.createdAt.toISOString(),
        })),
        { header: true },
      ),
    };
  }

  private validateEventDates(dto: CreateEventDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const registrationDeadline = new Date(dto.registrationDeadline);

    if (startDate <= new Date()) {
      throw new BadRequestException('Event start date must be in the future.');
    }

    if (endDate <= startDate) {
      throw new BadRequestException('Event end date must be after start date.');
    }

    if (registrationDeadline >= startDate) {
      throw new BadRequestException(
        'Registration deadline must be before start date.',
      );
    }
  }

  private async createUniqueSlug(title: string, excludeId?: string) {
    const baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.eventRepository.findOne({
        where: excludeId ? { slug, id: Not(excludeId) } : { slug },
      });

      if (!existing || existing.id === excludeId) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }
  }

  private toEventResponse(event: Event, registrationEventIds: string[] = []) {
    return {
      id: event.id,
      title: event.title,
      slug: event.slug,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      registrationDeadline: event.registrationDeadline,
      location: event.location,
      maxAttendees: event.maxAttendees,
      currentRegistrations: event.currentRegistrations,
      status: event.status,
      price: event.price,
      priceOptions: event.priceOptions,
      imageUrl: event.imageUrl,
      metadata: event.metadata,
      cancellationPolicy: event.cancellationPolicy,
      categories: event.categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
      })),
      organizer: {
        id: event.organizer.id,
        email: event.organizer.email,
        fullName: event.organizer.profile.fullName,
      },
      isFull:
        event.maxAttendees > 0 &&
        event.currentRegistrations >= event.maxAttendees,
      registrationOpen:
        event.status === EventStatus.Published &&
        event.registrationDeadline >= new Date(),
      isRegistered: registrationEventIds.includes(event.id),
    };
  }

  private async notifyParticipants(
    eventId: string,
    type: NotificationType,
    payload: Record<string, string>,
  ) {
    const registrations = await this.registrationRepository.find({
      where: { event: { id: eventId } },
      relations: { user: { profile: true } },
    });

    for (const registration of registrations) {
      await this.notificationsService.queueNotification(
        type,
        registration.user.email,
        {
          name: registration.user.profile.fullName,
          ...payload,
        },
      );
    }
  }
}
