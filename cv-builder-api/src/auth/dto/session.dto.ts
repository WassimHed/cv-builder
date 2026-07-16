import { ApiProperty } from '@nestjs/swagger';

export class SessionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  familyId!: string;

  @ApiProperty({ enum: ['active', 'revoked', 'expired'] })
  status!: 'active' | 'revoked' | 'expired';

  @ApiProperty()
  isCurrent!: boolean;

  @ApiProperty({ nullable: true })
  userAgent!: string | null;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty({ nullable: true })
  revokedAt!: Date | null;
}
