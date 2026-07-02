import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SkillsContentDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  items!: string[];
}
