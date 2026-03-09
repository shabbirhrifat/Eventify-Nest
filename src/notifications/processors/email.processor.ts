import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { JobName } from '../../common/enums/job-name.enum';
import { QueueName } from '../../common/enums/queue-name.enum';
import { NotificationsService } from '../notifications.service';

@Injectable()
@Processor(QueueName.Email)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<{ deliveryId: string }>) {
    if (job.name !== String(JobName.SendEmail)) {
      return;
    }

    const delivery = await this.notificationsService.getDelivery(
      job.data.deliveryId,
    );

    if (!delivery) {
      return;
    }

    const transporter = this.createTransporter();

    try {
      await transporter.sendMail({
        from: `${this.configService.get<string>('mail.fromName')} <${this.configService.get<string>('mail.fromEmail')}>`,
        to: delivery.recipientEmail,
        subject: delivery.subject,
        html: delivery.htmlBody,
        text: delivery.textBody,
      });

      await this.notificationsService.markDeliverySent(delivery.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown mail error';
      await this.notificationsService.markDeliveryFailed(delivery.id, message);
      this.logger.error(`Email delivery failed: ${message}`);
      throw error;
    }
  }

  private createTransporter() {
    const host = this.configService.get<string>('mail.host') ?? 'localhost';

    if (host === 'log') {
      return nodemailer.createTransport({ jsonTransport: true });
    }

    return nodemailer.createTransport({
      host,
      port: this.configService.get<number>('mail.port') ?? 1025,
      secure: false,
      auth: this.configService.get<string>('mail.user')
        ? {
            user: this.configService.get<string>('mail.user'),
            pass: this.configService.get<string>('mail.password'),
          }
        : undefined,
    });
  }
}
