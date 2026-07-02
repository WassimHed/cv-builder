import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum LanguageProficiency {
  BASIC = 'basic',
  CONVERSATIONAL = 'conversational',
  FLUENT = 'fluent',
  NATIVE = 'native',
}

export class LanguagesContentDto {
  @ApiProperty()
  @IsString()
  language!: string;

  @ApiProperty({ enum: LanguageProficiency })
  @IsEnum(LanguageProficiency)
  proficiency!: LanguageProficiency;
}
