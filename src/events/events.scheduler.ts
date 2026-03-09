import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { EventStatus } from '../common/enums/event-status.enum';
import { Event } from './entities/event.entity';

@Injectable()
export class EventsScheduler {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncLifecycleStatuses() {
    const now = new Date();

    await this.eventRepository.update(
      {
        status: EventStatus.Published,
        startDate: LessThanOrEqual(now),
        endDate: MoreThan(now),
      },
      { status: EventStatus.Ongoing },
    );

    await this.eventRepository.update(
      {
        status: EventStatus.Ongoing,
        endDate: LessThanOrEqual(now),
      },
      { status: EventStatus.Completed },
    );
  }
}
