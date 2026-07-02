import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EducationContentDto {
  @ApiProperty()
  @IsString()
  institution!: string;

  @ApiProperty()
  @IsString()
  degree!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
