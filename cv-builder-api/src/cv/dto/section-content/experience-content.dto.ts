import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExperienceContentDto {
  @ApiProperty()
  @IsString()
  company!: string;

  @ApiProperty()
  @IsString()
  role!: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  bullets!: string[];
}
