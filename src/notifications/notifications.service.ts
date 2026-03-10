import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { QueueName } from '../common/enums/queue-name.enum';
import { JobName } from '../common/enums/job-name.enum';
import { NotificationType } from '../common/enums/notification-type.enum';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';

type TemplatePayload = Record<string, string | number | null | undefined>;
type TemplateSeed = Pick<
  NotificationTemplate,
  'type' | 'subjectTemplate' | 'htmlTemplate' | 'textTemplate' | 'enabled'
>;

const DEFAULT_TEMPLATES: Record<NotificationType, TemplateSeed> = {
  [NotificationType.RegistrationConfirmation]: {
    type: NotificationType.RegistrationConfirmation,
    subjectTemplate: 'Registration confirmed for {{eventName}}',
    htmlTemplate:
      '<p>Hello {{name}}, your registration for <strong>{{eventName}}</strong> is confirmed.</p>',
    textTemplate:
      'Hello {{name}}, your registration for {{eventName}} is confirmed.',
    enabled: true,
  },
  [NotificationType.PaymentConfirmation]: {
    type: NotificationType.PaymentConfirmation,
    subjectTemplate: 'Payment confirmed for {{eventName}}',
    htmlTemplate: '<p>Your payment for {{eventName}} has been confirmed.</p>',
    textTemplate: 'Your payment for {{eventName}} has been confirmed.',
    enabled: true,
  },
  [NotificationType.EventReminder]: {
    type: NotificationType.EventReminder,
    subjectTemplate: 'Reminder: {{eventName}} starts soon',
    htmlTemplate: '<p>Reminder: {{eventName}} starts at {{startDate}}.</p>',
    textTemplate: 'Reminder: {{eventName}} starts at {{startDate}}.',
    enabled: true,
  },
  [NotificationType.WaitlistConfirmation]: {
    type: NotificationType.WaitlistConfirmation,
    subjectTemplate: 'You joined the waitlist for {{eventName}}',
    htmlTemplate: '<p>You are on the waitlist for {{eventName}}.</p>',
    textTemplate: 'You are on the waitlist for {{eventName}}.',
    enabled: true,
  },
  [NotificationType.SpotAvailable]: {
    type: NotificationType.SpotAvailable,
    subjectTemplate: 'A spot is now available for {{eventName}}',
    htmlTemplate:
      '<p>A spot is available for {{eventName}}. Claim it before {{offerExpiresAt}}.</p>',
    textTemplate:
      'A spot is available for {{eventName}}. Claim it before {{offerExpiresAt}}.',
    enabled: true,
  },
  [NotificationType.CancellationConfirmation]: {
    type: NotificationType.CancellationConfirmation,
    subjectTemplate: 'Registration cancelled for {{eventName}}',
    htmlTemplate:
      '<p>Your registration for {{eventName}} has been cancelled.</p>',
    textTemplate: 'Your registration for {{eventName}} has been cancelled.',
    enabled: true,
  },
  [NotificationType.EventChanged]: {
    type: NotificationType.EventChanged,
    subjectTemplate: 'Important update for {{eventName}}',
    htmlTemplate: '<p>There has been an update for {{eventName}}.</p>',
    textTemplate: 'There has been an update for {{eventName}}.',
    enabled: true,
  },
};

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepository: Repository<NotificationDelivery>,
    @InjectQueue(QueueName.Email)
    private readonly emailQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      for (const type of Object.values(NotificationType)) {
        const existing = await this.templateRepository.findOne({
          where: { type },
        });

        if (!existing) {
          const template = this.templateRepository.create(
            DEFAULT_TEMPLATES[type],
          );
          await this.templateRepository.save(template);
        }
      }
    } catch (error: any) {
      // If tables don't exist yet, skip initialization
      // They will be created by TypeORM synchronization
      this.logger.warn(
        'Could not initialize notification templates. Tables might not exist yet.',
        error.message,
      );
    }
  }

  getTemplates() {
    return this.templateRepository.find({ order: { type: 'ASC' } });
  }

  async updateTemplate(
    type: NotificationType,
    dto: UpdateNotificationTemplateDto,
  ) {
    const template = await this.templateRepository.findOne({ where: { type } });

    if (!template) {
      throw new Error('Template not found.');
    }

    return this.templateRepository.save(
      this.templateRepository.merge(template, dto),
    );
  }

  async queueNotification(
    type: NotificationType,
    recipientEmail: string,
    payload: TemplatePayload,
  ) {
    const template = await this.templateRepository.findOne({ where: { type } });

    if (!template || !template.enabled) {
      this.logger.warn(`Notification template disabled or missing: ${type}`);
      return null;
    }

    const subject = this.interpolate(template.subjectTemplate, payload);
    const htmlBody = this.interpolate(template.htmlTemplate, payload);
    const textBody = this.interpolate(template.textTemplate, payload);

    const delivery = await this.deliveryRepository.save(
      this.deliveryRepository.create({
        type,
        recipientEmail,
        subject,
        htmlBody,
        textBody,
        payload,
        status: 'queued',
        sentAt: null,
        failedAt: null,
        failureReason: null,
      }),
    );

    const attempts =
      this.configService.get<number>('queues.emailAttempts') ?? 3;
    await this.emailQueue.add(
      JobName.SendEmail,
      { deliveryId: delivery.id },
      {
        attempts,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    return delivery;
  }

  async markDeliverySent(deliveryId: string) {
    await this.deliveryRepository.update(deliveryId, {
      status: 'sent',
      sentAt: new Date(),
      failedAt: null,
      failureReason: null,
    });
  }

  async markDeliveryFailed(deliveryId: string, reason: string) {
    await this.deliveryRepository.update(deliveryId, {
      status: 'failed',
      failedAt: new Date(),
      failureReason: reason,
    });
  }

  async getDelivery(deliveryId: string) {
    return this.deliveryRepository.findOne({ where: { id: deliveryId } });
  }

  private interpolate(template: string, payload: TemplatePayload) {
    return template.replace(/{{\s*(\w+)\s*}}/g, (_match, key: string) => {
      const value = payload[key];
      return value === undefined || value === null ? '' : String(value);
    });
  }
}
