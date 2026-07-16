import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  userId!: string;

  @Index({ unique: true })
  @Column()
  tokenHash!: string;

  // Groups a rotation lineage. Set once when a session starts (login),
  // carried through every subsequent /auth/refresh call. Lets us tell
  // "this is a normal rotation" from "this token was already used
  // elsewhere" (reuse/theft) and revoke the whole lineage in one shot.
  @Index()
  @Column()
  familyId!: string;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  revokedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  userAgent!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  ipAddress!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
