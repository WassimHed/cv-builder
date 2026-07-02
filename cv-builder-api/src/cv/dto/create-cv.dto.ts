import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CvStatus } from '../schemas/cv.schema';
import { CreateSectionDto } from './create-section.dto';

export class CreateCvDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetRole?: string;

  @ApiPropertyOptional({ enum: CvStatus })
  @IsOptional()
  @IsEnum(CvStatus)
  status?: CvStatus;

  @ApiPropertyOptional({ type: [CreateSectionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSectionDto)
  sections?: CreateSectionDto[];
}
