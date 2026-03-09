import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';

@Entity({ name: 'idempotency_keys' })
@Index(['key', 'scope'], { unique: true })
export class IdempotencyKey extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  key!: string;

  @Column({ type: 'varchar', length: 120 })
  scope!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  requestHash!: string;

  @Column({ type: 'jsonb', nullable: true })
  responseBody!: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  statusCode!: number | null;

  @Column({ type: 'boolean', default: false })
  completed!: boolean;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}
