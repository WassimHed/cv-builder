import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty()
  bio!: string | null;

  @ApiProperty()
  headline!: string | null;

  @ApiProperty()
  phone!: string | null;

  @ApiProperty()
  city!: string | null;

  @ApiProperty()
  country!: string | null;

  @ApiProperty()
  dateOfBirth!: string | null;

  @ApiProperty()
  nationality!: string | null;

  @ApiProperty()
  linkedinUrl!: string | null;

  @ApiProperty()
  githubUrl!: string | null;

  @ApiProperty()
  portfolioUrl!: string | null;

  @ApiProperty()
  hasAvatar!: boolean;
}
