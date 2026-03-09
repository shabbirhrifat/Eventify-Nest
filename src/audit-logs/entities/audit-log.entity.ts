import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';

@Entity({ name: 'audit_logs' })
@Index(['actorUserId', 'createdAt'])
export class AuditLog extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  action!: string;

  @Column({ type: 'varchar', length: 120 })
  entity!: string;

  @Column({ type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
