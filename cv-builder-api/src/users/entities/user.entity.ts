import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  @Exclude()
  password!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: 'timestamp', nullable: true, default: null })
  lockedUntil!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'varchar', nullable: true, default: null })
  resetTokenHash!: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  resetTokenExpiry!: Date | null;

  @Column({ default: false })
  isEmailVerified!: boolean;

  @Column({ type: 'varchar', nullable: true, default: null })
  emailVerificationTokenHash!: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  emailVerificationTokenExpiry!: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  passwordChangedAt!: Date | null;
}
