import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'refresh_tokens' })
@Index(['tokenId'], { unique: true })
export class RefreshToken extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  tokenId!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  hashedToken!: string;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  user!: User;
}
