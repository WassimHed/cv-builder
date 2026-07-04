import { IsDefined, IsEnum, IsOptional, IsString } from 'class-validator';
import { SectionType } from '../../cv/schemas/cv.schema';

export class RequestCvSuggestionsDto {
  @IsEnum(SectionType)
  sectionType!: SectionType;

  @IsDefined()
  content: unknown; // the raw section content, same shape stored in Mongo

  @IsOptional()
  @IsString()
  targetRole?: string;

  @IsOptional()
  @IsString()
  language?: string; // 'en' | 'fr'
}
