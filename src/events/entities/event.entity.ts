import {
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  VersionColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { EventStatus } from '../../common/enums/event-status.enum';
import { Category } from '../../categories/entities/category.entity';
import { Registration } from '../../registrations/entities/registration.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'events' })
@Index(['slug'], { unique: true })
@Index(['status', 'startDate'])
@Index(['registrationDeadline'])
export class Event extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 140 })
  slug!: string;

  @Column({ type: 'timestamptz' })
  startDate!: Date;

  @Column({ type: 'timestamptz' })
  endDate!: Date;

  @Column({ type: 'timestamptz' })
  registrationDeadline!: Date;

  @Column({ type: 'varchar', length: 255 })
  location!: string;

  @Column({ type: 'int', default: 0 })
  maxAttendees!: number;

  @Column({ type: 'int', default: 0 })
  currentRegistrations!: number;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.Draft })
  status!: EventStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price!: string;

  @Column({ type: 'jsonb', nullable: true })
  priceOptions!: Array<Record<string, unknown>> | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  cancellationPolicy!: Record<string, unknown> | null;

  @VersionColumn()
  version!: number;

  @ManyToOne(() => User, (user) => user.organizedEvents, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  organizer!: User;

  @ManyToMany(() => Category, (category) => category.events, { eager: true })
  @JoinTable({ name: 'event_categories' })
  categories!: Category[];

  @OneToMany(() => Registration, (registration) => registration.event)
  registrations!: Registration[];
}
