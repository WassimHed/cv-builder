import { IsEnum, IsInt, Min, IsDefined } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SectionType } from '../schemas/cv.schema';

export class CreateSectionDto {
  @ApiProperty({ enum: SectionType })
  @IsEnum(SectionType)
  type!: SectionType;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order!: number;

  @ApiProperty({
    description:
      'Shape depends on `type`. Validated separately in CvService against the per-type content DTO — see CONTENT_DTO_MAP.',
  })
  @IsDefined()
  content!: unknown;
}
