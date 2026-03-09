import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { addHours } from '../common/utils/date.util';
import {
  createPaginatedResponse,
  getPagination,
} from '../common/utils/pagination.util';
import { EventStatus } from '../common/enums/event-status.enum';
import { NotificationType } from '../common/enums/notification-type.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { RegistrationStatus } from '../common/enums/registration-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Event } from '../events/entities/event.entity';
import { User } from '../users/entities/user.entity';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationQueryDto } from './dto/registration-query.dto';
import { Registration } from './entities/registration.entity';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Registration)
    private readonly registrationRepository: Repository<Registration>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async createRegistration(
    userId: string,
    eventId: string,
    dto: CreateRegistrationDto,
    idempotencyKey: string,
  ) {
    const reservation = await this.idempotencyService.reserveOrReplay(
      idempotencyKey,
      `event-registration:${eventId}`,
      userId,
      this.idempotencyService.createRequestHash(dto),
    );

    if (reservation.type === 'replay') {
      return reservation.record.responseBody;
    }

    const reservationRecordId = reservation.record.id;

    const response = await this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(Event, {
        where: { id: eventId },
        relations: { organizer: true, categories: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!event) {
        throw new NotFoundException('Event not found.');
      }

      if (event.status !== EventStatus.Published) {
        throw new BadRequestException(
          'Only published events accept registrations.',
        );
      }

      if (event.registrationDeadline < new Date()) {
        throw new BadRequestException('Registration deadline has passed.');
      }

      const existingRegistration = await manager.findOne(Registration, {
        where: {
          event: { id: eventId },
          user: { id: userId },
        },
        relations: { event: true, user: { profile: true } },
      });

      if (
        existingRegistration &&
        existingRegistration.status !== RegistrationStatus.Cancelled
      ) {
        throw new ConflictException(
          'You are already registered for this event.',
        );
      }

      const user = await manager.findOne(User, {
        where: { id: userId },
        relations: { profile: true },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const isFull =
        event.maxAttendees > 0 &&
        event.currentRegistrations >= event.maxAttendees;
      const paymentAmount = Number(
        dto.selectedPriceOption?.amount ?? event.price ?? 0,
      ).toFixed(2);
      const registrationStatus = isFull
        ? RegistrationStatus.Waitlisted
        : Number(paymentAmount) > 0
          ? RegistrationStatus.Pending
          : RegistrationStatus.Confirmed;
      const paymentStatus =
        Number(paymentAmount) > 0 ? PaymentStatus.Pending : PaymentStatus.Paid;

      const registration = manager.create(Registration, {
        event,
        user,
        registrationNumber: this.buildRegistrationNumber(event.id),
        status: registrationStatus,
        cancellationDate: null,
        paymentStatus,
        paymentAmount,
        paymentMethod: dto.paymentMethod ?? null,
        selectedPriceOption: dto.selectedPriceOption ?? null,
        checkInTime: null,
        metadata: dto.metadata ?? null,
        qrCodeDataUrl:
          registrationStatus === RegistrationStatus.Confirmed
            ? await QRCode.toDataURL(`registration:${event.id}:${user.id}`)
            : null,
        waitlistPromotedAt: null,
        waitlistOfferExpiresAt: null,
      });

      const savedRegistration = await manager.save(registration);

      if (!isFull && registrationStatus !== RegistrationStatus.Waitlisted) {
        const updateResult = await manager
          .createQueryBuilder()
          .update(Event)
          .set({
            currentRegistrations: () => 'current_registrations + 1',
            version: () => 'version + 1',
          })
          .where('id = :id', { id: event.id })
          .andWhere('version = :version', { version: event.version })
          .execute();

        if (updateResult.affected !== 1) {
          throw new ConflictException(
            'Event capacity changed while your registration was processing. Please retry.',
          );
        }
      }

      return manager.findOneOrFail(Registration, {
        where: { id: savedRegistration.id },
        relations: {
          event: { organizer: { profile: true }, categories: true },
          user: { profile: true },
        },
      });
    });

    if (response.status === RegistrationStatus.Waitlisted) {
      await this.notificationsService.queueNotification(
        NotificationType.WaitlistConfirmation,
        response.user.email,
        {
          name: response.user.profile.fullName,
          eventName: response.event.title,
        },
      );
    } else {
      await this.notificationsService.queueNotification(
        NotificationType.RegistrationConfirmation,
        response.user.email,
        {
          name: response.user.profile.fullName,
          eventName: response.event.title,
        },
      );
    }

    await this.auditLogsService.record(
      'registration.created',
      'registration',
      userId,
      {
        registrationId: response.id,
        eventId,
        status: response.status,
      },
    );

    const serializedResponse = this.toResponse(response);
    await this.idempotencyService.complete(
      reservationRecordId,
      201,
      serializedResponse,
    );
    return serializedResponse;
  }

  async listMyRegistrations(userId: string) {
    const registrations = await this.registrationRepository.find({
      where: { user: { id: userId } },
      relations: {
        event: { categories: true, organizer: { profile: true } },
        user: { profile: true },
      },
      order: { createdAt: 'DESC' },
    });

    return registrations.map((registration) => this.toResponse(registration));
  }

  async cancelRegistration(userId: string, registrationId: string) {
    const registration = await this.registrationRepository.findOne({
      where: { id: registrationId },
      relations: { event: true, user: { profile: true } },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found.');
    }

    if (registration.user.id !== userId) {
      throw new ForbiddenException(
        'You can only cancel your own registration.',
      );
    }

    if (registration.status === RegistrationStatus.Cancelled) {
      throw new BadRequestException('Registration has already been cancelled.');
    }

    if (registration.event.registrationDeadline < new Date()) {
      throw new BadRequestException(
        'Cancellation is no longer allowed for this event.',
      );
    }

    const wasWaitlisted = registration.status === RegistrationStatus.Waitlisted;

    await this.dataSource.transaction(async (manager) => {
      const lockedEvent = await manager.findOne(Event, {
        where: { id: registration.event.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedEvent) {
        throw new NotFoundException('Event not found.');
      }

      registration.status = RegistrationStatus.Cancelled;
      registration.cancellationDate = new Date();
      registration.paymentStatus =
        Number(registration.paymentAmount) > 0
          ? PaymentStatus.Refunded
          : registration.paymentStatus;
      await manager.save(registration);

      if (lockedEvent.currentRegistrations > 0 && !wasWaitlisted) {
        const result = await manager
          .createQueryBuilder()
          .update(Event)
          .set({
            currentRegistrations: () =>
              'GREATEST(current_registrations - 1, 0)',
            version: () => 'version + 1',
          })
          .where('id = :id', { id: lockedEvent.id })
          .andWhere('version = :version', { version: lockedEvent.version })
          .execute();

        if (result.affected !== 1) {
          throw new ConflictException(
            'Event capacity changed during cancellation.',
          );
        }
      }
    });

    await this.auditLogsService.record(
      'registration.cancelled',
      'registration',
      userId,
      {
        registrationId,
      },
    );

    await this.promoteWaitlist(registration.event.id);
    await this.notificationsService.queueNotification(
      NotificationType.CancellationConfirmation,
      registration.user.email,
      {
        name: registration.user.profile.fullName,
        eventName: registration.event.title,
      },
    );

    return { message: 'Registration cancelled successfully.' };
  }

  async claimWaitlistOffer(userId: string, registrationId: string) {
    return this.dataSource.transaction(async (manager) => {
      const registration = await manager.findOne(Registration, {
        where: { id: registrationId },
        relations: { user: true, event: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!registration) {
        throw new NotFoundException('Registration not found.');
      }

      if (registration.user.id !== userId) {
        throw new ForbiddenException(
          'You can only claim your own waitlist offer.',
        );
      }

      if (
        !registration.waitlistOfferExpiresAt ||
        registration.waitlistOfferExpiresAt < new Date()
      ) {
        throw new BadRequestException('This waitlist offer has expired.');
      }

      const event = await manager.findOne(Event, {
        where: { id: registration.event.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!event) {
        throw new NotFoundException('Event not found.');
      }

      registration.status =
        Number(registration.paymentAmount) > 0
          ? RegistrationStatus.Pending
          : RegistrationStatus.Confirmed;
      registration.waitlistPromotedAt = null;
      registration.waitlistOfferExpiresAt = null;
      registration.qrCodeDataUrl =
        registration.status === RegistrationStatus.Confirmed
          ? await QRCode.toDataURL(`registration:${event.id}:${userId}`)
          : null;
      await manager.save(registration);

      const result = await manager
        .createQueryBuilder()
        .update(Event)
        .set({
          currentRegistrations: () => 'current_registrations + 1',
          version: () => 'version + 1',
        })
        .where('id = :id', { id: event.id })
        .andWhere('version = :version', { version: event.version })
        .execute();

      if (result.affected !== 1) {
        throw new ConflictException(
          'Event capacity changed during waitlist claim.',
        );
      }

      return this.toResponse(registration);
    });
  }

  async checkIn(actorUserId: string, registrationId: string) {
    const registration = await this.registrationRepository.findOne({
      where: { id: registrationId },
      relations: { event: { organizer: true }, user: { profile: true } },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found.');
    }

    const actor = await this.userRepository.findOne({
      where: { id: actorUserId },
    });

    if (!actor) {
      throw new NotFoundException('Actor not found.');
    }

    if (
      actor.role !== UserRole.Admin &&
      registration.event.organizer.id !== actorUserId
    ) {
      throw new ForbiddenException(
        'You can only check in registrations for your own events.',
      );
    }

    if (registration.checkInTime) {
      throw new BadRequestException('This participant has already checked in.');
    }

    if (registration.status !== RegistrationStatus.Confirmed) {
      throw new BadRequestException(
        'Only confirmed registrations can be checked in.',
      );
    }

    registration.checkInTime = new Date();
    registration.status = RegistrationStatus.Attended;
    await this.registrationRepository.save(registration);

    await this.auditLogsService.record(
      'registration.checked_in',
      'registration',
      actorUserId,
      {
        registrationId,
      },
    );

    return this.toResponse(registration);
  }

  async adminList(query: RegistrationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const qb = this.registrationRepository
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.user', 'user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('registration.event', 'event')
      .leftJoinAndSelect('event.organizer', 'organizer')
      .leftJoinAndSelect('organizer.profile', 'organizerProfile');

    if (query.status) {
      qb.andWhere('registration.status = :status', { status: query.status });
    }

    if (query.paymentStatus) {
      qb.andWhere('registration.paymentStatus = :paymentStatus', {
        paymentStatus: query.paymentStatus,
      });
    }

    if (query.eventId) {
      qb.andWhere('event.id = :eventId', { eventId: query.eventId });
    }

    if (query.search) {
      qb.andWhere(
        '(registration.registrationNumber ILIKE :search OR user.email ILIKE :search OR event.title ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('registration.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return createPaginatedResponse(
      items.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
    );
  }

  async exportEventRegistrations(eventId: string) {
    const registrations = await this.registrationRepository.find({
      where: { event: { id: eventId } },
      relations: { user: { profile: true }, event: true },
      order: { createdAt: 'ASC' },
    });

    return registrations.map((registration) => ({
      registrationNumber: registration.registrationNumber,
      email: registration.user.email,
      name: registration.user.profile.fullName,
      eventTitle: registration.event.title,
      status: registration.status,
      paymentStatus: registration.paymentStatus,
      checkInTime: registration.checkInTime?.toISOString() ?? '',
      createdAt: registration.createdAt.toISOString(),
    }));
  }

  async promoteWaitlist(eventId: string) {
    const waitlisted = await this.registrationRepository.findOne({
      where: {
        event: { id: eventId },
        status: RegistrationStatus.Waitlisted,
        waitlistOfferExpiresAt: IsNull(),
      },
      relations: { user: { profile: true }, event: true },
      order: { createdAt: 'ASC' },
    });

    if (!waitlisted) {
      return null;
    }

    waitlisted.waitlistPromotedAt = new Date();
    waitlisted.waitlistOfferExpiresAt = addHours(new Date(), 24);
    await this.registrationRepository.save(waitlisted);

    await this.notificationsService.queueNotification(
      NotificationType.SpotAvailable,
      waitlisted.user.email,
      {
        name: waitlisted.user.profile.fullName,
        eventName: waitlisted.event.title,
        offerExpiresAt: waitlisted.waitlistOfferExpiresAt.toISOString(),
      },
    );

    return this.toResponse(waitlisted);
  }

  private buildRegistrationNumber(eventId: string) {
    const compactEventId = eventId.replace(/-/g, '').slice(0, 6).toUpperCase();
    return `EVT${compactEventId}-${Date.now()}-${Math.floor(
      Math.random() * 1000,
    )
      .toString()
      .padStart(3, '0')}`;
  }

  private toResponse(registration: Registration): Record<string, unknown> {
    return {
      id: registration.id,
      registrationNumber: registration.registrationNumber,
      status: registration.status,
      paymentStatus: registration.paymentStatus,
      paymentAmount: registration.paymentAmount,
      paymentMethod: registration.paymentMethod,
      selectedPriceOption: registration.selectedPriceOption,
      checkInTime: registration.checkInTime,
      cancellationDate: registration.cancellationDate,
      qrCodeDataUrl: registration.qrCodeDataUrl,
      waitlistPromotedAt: registration.waitlistPromotedAt,
      waitlistOfferExpiresAt: registration.waitlistOfferExpiresAt,
      event: {
        id: registration.event.id,
        title: registration.event.title,
        slug: registration.event.slug,
        startDate: registration.event.startDate,
        endDate: registration.event.endDate,
        location: registration.event.location,
      },
      user: {
        id: registration.user.id,
        email: registration.user.email,
        fullName: registration.user.profile.fullName,
      },
      createdAt: registration.createdAt,
    };
  }
}
