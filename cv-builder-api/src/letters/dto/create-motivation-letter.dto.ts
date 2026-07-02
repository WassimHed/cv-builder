import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMotivationLetterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cvId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetCompany?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetRole?: string;

  @ApiProperty()
  @IsString()
  content!: string;
}