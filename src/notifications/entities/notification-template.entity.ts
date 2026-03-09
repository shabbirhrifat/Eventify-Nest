import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { NotificationType } from '../../common/enums/notification-type.enum';

@Entity({ name: 'notification_templates' })
@Index(['type'], { unique: true })
export class NotificationTemplate extends BaseEntity {
  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  subjectTemplate!: string;

  @Column({ type: 'text' })
  htmlTemplate!: string;

  @Column({ type: 'text' })
  textTemplate!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;
}
