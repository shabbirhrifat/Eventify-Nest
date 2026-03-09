import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RegistrationStatus } from '../common/enums/registration-status.enum';
import { Registration } from './entities/registration.entity';
import { RegistrationsService } from './registrations.service';

@Injectable()
export class RegistrationsScheduler {
  constructor(
    @InjectRepository(Registration)
    private readonly registrationRepository: Repository<Registration>,
    private readonly registrationsService: RegistrationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async recycleExpiredWaitlistOffers() {
    const expiredOffers = await this.registrationRepository.find({
      where: {
        status: RegistrationStatus.Waitlisted,
        waitlistOfferExpiresAt: LessThan(new Date()),
      },
      relations: { event: true },
    });

    for (const registration of expiredOffers) {
      registration.waitlistPromotedAt = null;
      registration.waitlistOfferExpiresAt = null;
      await this.registrationRepository.save(registration);
      await this.registrationsService.promoteWaitlist(registration.event.id);
    }
  }
}
