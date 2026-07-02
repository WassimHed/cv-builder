import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CertificationsContentDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  issuer!: string;

  @ApiProperty()
  @IsDateString()
  issueDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  credentialUrl?: string;
}
