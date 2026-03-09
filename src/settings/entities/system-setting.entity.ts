import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';

@Entity({ name: 'system_settings' })
@Index(['key'], { unique: true })
export class SystemSetting extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  key!: string;

  @Column({ type: 'jsonb' })
  value!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
