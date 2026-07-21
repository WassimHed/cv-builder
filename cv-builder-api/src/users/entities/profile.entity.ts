import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { StorageBackend } from '../../storage/interfaces/storage-backend.enum';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'text', nullable: true, default: null })
  bio!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  headline!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  city!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  country!: string | null;

  @Column({ type: 'date', nullable: true, default: null })
  dateOfBirth!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  nationality!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  linkedinUrl!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  githubUrl!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  portfolioUrl!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  avatarKey!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  avatarBackend!: StorageBackend | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
