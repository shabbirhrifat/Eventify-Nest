import {
  Column,
  Entity,
  Index,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { Event } from '../../events/entities/event.entity';

@Entity({ name: 'categories' })
@Index(['name'], { unique: true })
@Index(['slug'], { unique: true })
export class Category extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 140 })
  slug!: string;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  parent!: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children!: Category[];

  @ManyToMany(() => Event, (event) => event.categories)
  events!: Event[];
}
