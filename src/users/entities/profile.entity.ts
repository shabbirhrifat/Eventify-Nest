import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { User } from './user.entity';

@Entity({ name: 'profiles' })
export class Profile extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  fullName!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  organization!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatarUrl!: string | null;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;
}
