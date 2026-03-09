import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { NotificationType } from '../../common/enums/notification-type.enum';

@Entity({ name: 'notification_deliveries' })
@Index(['recipientEmail', 'createdAt'])
export class NotificationDelivery extends BaseEntity {
  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  recipientEmail!: string;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ type: 'text' })
  htmlBody!: string;

  @Column({ type: 'text' })
  textBody!: string;

  @Column({ type: 'varchar', length: 40, default: 'queued' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  failedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;
}
