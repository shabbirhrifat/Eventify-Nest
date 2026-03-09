import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { RegistrationStatus } from '../../common/enums/registration-status.enum';
import { Event } from '../../events/entities/event.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'registrations' })
@Index(['registrationNumber'], { unique: true })
@Index(['event', 'user'], { unique: true })
export class Registration extends BaseEntity {
  @ManyToOne(() => Event, (event) => event.registrations, {
    onDelete: 'CASCADE',
  })
  event!: Event;

  @ManyToOne(() => User, (user) => user.registrations, {
    onDelete: 'CASCADE',
  })
  user!: User;

  @Column({ type: 'varchar', length: 80 })
  registrationNumber!: string;

  @Column({
    type: 'enum',
    enum: RegistrationStatus,
    default: RegistrationStatus.Pending,
  })
  status!: RegistrationStatus;

  @Column({ type: 'timestamptz', nullable: true })
  cancellationDate!: Date | null;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.Pending,
  })
  paymentStatus!: PaymentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  paymentAmount!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  selectedPriceOption!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkInTime!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  qrCodeDataUrl!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  waitlistPromotedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  waitlistOfferExpiresAt!: Date | null;
}
