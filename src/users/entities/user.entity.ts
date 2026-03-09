import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { Event } from '../../events/entities/event.entity';
import { Registration } from '../../registrations/entities/registration.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { Profile } from './profile.entity';

@Entity({ name: 'users' })
@Index(['email'], { unique: true })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.Participant })
  role!: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active })
  status!: UserStatus;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  emailVerificationToken!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @OneToOne(() => Profile, (profile) => profile.user, {
    cascade: true,
    eager: true,
  })
  profile!: Profile;

  @OneToMany(() => Event, (event) => event.organizer)
  organizedEvents!: Event[];

  @OneToMany(() => Registration, (registration) => registration.user)
  registrations!: Registration[];

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens!: RefreshToken[];

  @BeforeInsert()
  normalizeEmail() {
    this.email = this.email.trim().toLowerCase();
  }
}
