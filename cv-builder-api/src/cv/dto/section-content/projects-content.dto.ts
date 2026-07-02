import { IsString, IsOptional, IsArray, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectsContentDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  technologies!: string[];
}
